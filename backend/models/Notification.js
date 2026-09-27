const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'critical_complaint', 'new_assignment', 'verification_required',
      'false_closure_alert', 'status_update', 'overdue_alert', 'general',
      'agentic_task_assigned', 'agentic_escalation'
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

// Trigger reload

// Trigger nodemon reload for Auth Fix

// Trigger nodemon reload for Auto Assign Fix

// Trigger nodemon reload for Prompt Fix

// Trigger nodemon reload for Email Fix

// Trigger nodemon reload for Auth Object Fix

// Trigger nodemon reload for commentController

// Trigger nodemon reload for Subtask Proof of Work

// Trigger nodemon reload for Agentic Coordinator Assignment Mismatch

// Trigger nodemon reload for escalated status update
