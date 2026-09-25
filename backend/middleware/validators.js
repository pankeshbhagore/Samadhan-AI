const { validationResult, body, param } = require('express-validator');
const { AppError } = require('./errorHandler');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new AppError(message, 400));
  }
  next();
};

exports.validate = validate;

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim().matches(/^[0-9]{10}$/).withMessage('Phone must be a 10-digit number'),
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

exports.complaintRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('category').optional().isIn(['roads_potholes', 'water_supply', 'garbage_sanitation', 'sewage', 'electricity', 'street_lights', 'traffic', 'encroachment', 'pollution', 'park_maintenance', 'building_safety', 'drainage', 'public_transport', 'noise_complaint', 'other']).withMessage('Invalid category'),
  body('address').trim().notEmpty().withMessage('Address is required'),
];

exports.commentRules = [
  body('message').trim().notEmpty().withMessage('Comment message is required').isLength({ max: 1000 }).withMessage('Comment must be under 1000 characters'),
];

exports.mongoIdParam = (field = 'id') => [
  param(field).isMongoId().withMessage('Invalid ID format'),
];

exports.statusUpdateRules = [
  body('status').notEmpty().withMessage('Status is required').isIn(['under_review', 'in_progress', 'pending_verification', 'escalated', 'rejected']).withMessage('Invalid status'),
  body('note').optional().trim().isLength({ max: 1000 }),
  body('resolutionNote').optional().trim().isLength({ max: 2000 }),
];

exports.assignRules = [
  body('officerId').notEmpty().withMessage('Officer ID is required').isMongoId().withMessage('Invalid officer ID'),
  body('note').optional().trim().isLength({ max: 1000 }),
];

exports.verifyRules = [
  body('confirmed').isBoolean().withMessage('confirmed (boolean) is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('rejectionReason').optional().trim().isLength({ max: 1000 }),
];
