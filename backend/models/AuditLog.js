const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  entityType: { type: String, enum: ['complaint', 'user', 'department', 'visit'] },
  entityId: mongoose.Schema.Types.ObjectId,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  suspicious: { type: Boolean, default: false },
  suspicionReason: String,
  state: String
}, { timestamps: true });

auditLogSchema.index({ suspicious: 1, createdAt: -1 });
auditLogSchema.index({ entityId: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ state: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
