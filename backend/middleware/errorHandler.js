class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Wraps async route handlers so thrown errors / rejected promises reach errorHandler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    statusCode = 400;
  }

  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((e) => e.message).join(', ');
    statusCode = 400;
  }

  if (err.name === 'JsonWebTokenError') { message = 'Invalid authentication token'; statusCode = 401; }
  if (err.name === 'TokenExpiredError') { message = 'Session expired, please log in again'; statusCode = 401; }
  if (err.name === 'CastError') { message = `Invalid ${err.path}: ${err.value}`; statusCode = 400; }
  if (err.code === 'LIMIT_FILE_SIZE') { message = 'File too large (max 5MB)'; statusCode = 400; }

  if (process.env.NODE_ENV === 'development') console.error('❌ ERROR:', err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

module.exports = { errorHandler, notFound, AppError, asyncHandler };
