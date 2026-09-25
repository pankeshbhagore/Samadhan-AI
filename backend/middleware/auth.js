const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('./errorHandler');

exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new AppError('Not authorized — no token provided', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }

  const user = await User.findById(decoded.id).populate('department', 'name code slaHours contactEmail');
  if (!user) throw new AppError('User no longer exists', 401);
  if (!user.isActive) throw new AppError('Account has been deactivated. Contact admin.', 403);
  if (user.changedPasswordAfter(decoded.iat)) {
    throw new AppError('Password recently changed. Please log in again.', 401);
  }

  req.user = user;
  next();
});

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(`Role '${req.user.role}' is not authorized for this action`, 403));
  }
  next();
};
