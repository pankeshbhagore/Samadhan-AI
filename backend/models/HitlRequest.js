const mongoose = require('mongoose');

const HitlRequestSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: false // Optional for mass email, required for CREATE_PLAN and ESCALATION
  },
  type: {
    type: String,
    enum: ['CREATE_PLAN', 'ESCALATION', 'MASS_EMAIL'],
    required: true
  },
  contextData: {
    type: mongoose.Schema.Types.Mixed,
    description: 'The AI reasoning or context for this action'
  },
  proposedAction: {
    type: mongoose.Schema.Types.Mixed,
    description: 'The proposed payload, e.g., new agenticPlan or email HTML'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  adminComments: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('HitlRequest', HitlRequestSchema);
