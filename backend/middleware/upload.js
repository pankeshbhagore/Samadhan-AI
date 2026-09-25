const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./errorHandler');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  const extOk = ALLOWED_EXT.test(file.originalname);
  const mimeOk = ALLOWED_MIME.includes(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new AppError('Only JPG, PNG, or WEBP images are allowed', 400));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, files: 5 }
});

module.exports = upload;
