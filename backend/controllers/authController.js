const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const safeUser = user.toSafeObject ? user.toSafeObject() : user;
  res.status(statusCode).json({ success: true, token, user: safeUser });
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, ward, district, state } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('Email is already registered', 400);

  const user = await User.create({ name, email, password, phone, ward, district, state, role: 'citizen' });
  sendToken(user, 201, res);
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password').populate('department', 'name code');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('Account has been deactivated. Contact admin.', 403);

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  sendToken(user, 200, res);
});

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate('department', 'name code contactEmail contactPhone');
  res.json({ success: true, user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, ward, district, state } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, phone, ward, district, state },
    { new: true, runValidators: true }
  ).populate('department', 'name code');
  res.json({ success: true, user });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.matchPassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();
  sendToken(user, 200, res);
});

const crypto = require('crypto');

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  if (!user) throw new AppError('There is no user with that email address', 404);

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // In a real application, send this token via Email.
  // For now, we simulate success and return it in dev environments or print it to console.
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
  console.log(`[Email Simulation] Password reset requested for ${user.email}. Link: ${resetUrl}`);

  res.status(200).json({
    success: true,
    message: 'Password reset token sent to email',
    // In production, NEVER send the token in the response. We include it here just for easy demo/testing.
    ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) throw new AppError('Invalid or expired password reset token', 400);

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendToken(user, 200, res);
});
