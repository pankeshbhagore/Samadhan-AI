const Notification = require('../models/Notification');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

exports.getNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly, limit = 30 } = req.query;
  const query = { recipient: req.user._id };
  if (unreadOnly === 'true') query.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query).sort('-createdAt').limit(Math.min(100, parseInt(limit))).populate('complaint', 'ticketId title status'),
    Notification.countDocuments({ recipient: req.user._id, isRead: false })
  ]);

  res.json({ success: true, notifications, unreadCount });
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true, notification });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  res.json({ success: true, message: 'All notifications marked as read' });
});
