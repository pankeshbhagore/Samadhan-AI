const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'critical_complaint', 'new_assignment', 'verification_required',
      'false_closure_alert', 'status_update', 'overdue_alert', 'general'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  isRead: { type: Boolean, default: false },
  readAt: Date
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
