require('dotenv').config();
require('./utils/telemetry'); // Initialize OpenTelemetry for Agentic AI Circuit Breaker
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const { connectRedis } = require('./services/redisService');
const { initCronJobs } = require('./services/cronService');
const routes = require('./routes/index');
const Complaint = require('./models/Complaint');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true
};

const io = new Server(server, {
  cors: { origin: corsOptions.origin, methods: ['GET', 'POST'] }
});

connectDB();
connectRedis();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(uploadsDir));

// Specific limiters first — Express matches routes in order
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: 'Too many login attempts, try again later' } }));
app.use('/api/track/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, message: 'Too many tracking requests, try again later' } }));

// Protect against spam/bot submissions
app.use('/api/complaints', rateLimit({ 
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 complaints per hour
  message: { success: false, message: 'You have exceeded the maximum number of complaints. Please try again later.' },
  skip: (req) => req.method !== 'POST' // Only rate limit the POST creation, allow GET viewing
}));

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 3000, standardHeaders: true, legacyHeaders: false }));

app.use((req, res, next) => { req.io = io; next(); });

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/api', routes);
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date(), mode: process.env.NODE_ENV }));

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'))
  );
} else {
  app.get('/', (req, res) => res.send('API is running...'));
}

app.use(notFound);
app.use(errorHandler);

// ---------- Socket.IO ----------
// Each authenticated socket joins a per-user room (`user_<id>`), which is the
// only reliable way to target a specific user. The previous implementation
// emitted to ad-hoc event names like `officer_${id}` which only worked if the
// listener was registered with that exact string — a fragile pattern that
// silently failed to notify anyone who reconnected with a new socket without
// re-subscribing to that literal event name.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      const User = require('./models/User');
      const user = await User.findById(decoded.id).select('role').lean();
      if (user) socket.userRole = user.role;
    }
    next();
  } catch {
    next(); // allow unauthenticated connection; just won't join a user room
  }
});

io.on('connection', (socket) => {
  if (socket.userId) {
    socket.join(`user_${socket.userId}`);
    if (socket.userRole) socket.join(`role_${socket.userRole}`);
  }
  socket.on('join_room', (room) => socket.join(room));
  socket.on('disconnect', () => {});
});

// ---------- Cron Jobs ----------
initCronJobs();

// ---------- Cron: hourly overdue sweep ----------
cron.schedule('0 * * * *', async () => {
  try {
    const updated = await Complaint.updateMany(
      { dueDate: { $lt: new Date() }, status: { $nin: ['resolved', 'rejected'] }, isOverdue: false },
      { $set: { isOverdue: true } }
    );
    if (updated.modifiedCount > 0) {
      io.to('role_cm').to('role_super_admin').emit('overdue_complaints', { count: updated.modifiedCount });
      console.log(`⏰ Marked ${updated.modifiedCount} complaints as overdue`);
    }
  } catch (err) {
    console.error('Cron error:', err.message);
  }
});

// ---------- Cron: Daily Predictive Maintenance ----------
cron.schedule('0 0 * * *', async () => {
  try {
    const { runPredictiveMaintenance } = require('./services/anomalyDetection');
    const alerts = await runPredictiveMaintenance(io);
    if (alerts > 0) {
      console.log(`🔧 Generated ${alerts} predictive maintenance alerts`);
    }
  } catch (err) {
    console.error('Predictive maintenance cron error:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`));
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;

// Trigger nodemon restart
