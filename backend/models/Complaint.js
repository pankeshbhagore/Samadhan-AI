const mongoose = require('mongoose');
const { getNextSequence } = require('./Counter');

const timelineSchema = new mongoose.Schema({
  status: { type: String, required: true },
  message: { type: String, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  proofImages: [String],
  isAutomatic: { type: Boolean, default: false }
}, { _id: false });

const verificationSchema = new mongoose.Schema({
  requestedAt: Date,
  respondedAt: Date,
  citizenConfirmed: { type: Boolean, default: null },
  citizenFeedback: String,
  satisfactionRating: { type: Number, min: 1, max: 5 },
  rejectionReason: String,
  escalatedAfterRejection: { type: Boolean, default: false },
  proofImageHashes: [String]
}, { _id: false });

const CATEGORIES = [
  'water_supply', 'sewage', 'roads_potholes', 'street_lights',
  'garbage_sanitation', 'electricity', 'traffic', 'encroachment',
  'pollution', 'park_maintenance', 'building_safety', 'drainage',
  'public_transport', 'noise_complaint', 'other'
];

const complaintSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },
  title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
  description: { type: String, required: [true, 'Description is required'], trim: true, maxlength: 2000 },

  category: { type: String, enum: CATEGORIES, required: [true, 'Category is required'] },
  subCategory: { type: String },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },

  priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
  isCritical: { type: Boolean, default: false },
  criticalReason: { type: String },

  status: {
    type: String,
    enum: ['submitted', 'under_review', 'assigned', 'in_progress', 'pending_verification', 'resolved', 'reopened', 'rejected', 'escalated', 'pending_hitl_approval'],
    default: 'submitted'
  },

  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }
  },
  address: { type: String, required: [true, 'Address is required'], trim: true },
  ward: { type: String, trim: true },
  district: { type: String, trim: true },
  state: { type: String, required: true },
  pincode: { type: String, trim: true },
  landmark: { type: String, trim: true },

  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  images: [String],
  isFake: { type: Boolean, default: false },
  fakeReason: { type: String },
  resolutionImages: [String],
  resolutionNote: { type: String },

  timeline: [timelineSchema],
  verification: verificationSchema,
  reopenCount: { type: Number, default: 0 },

  assignedAt: Date,
  resolvedAt: Date,
  dueDate: Date,
  resolutionTimeHours: Number,
  isOverdue: { type: Boolean, default: false },

  source: { type: String, enum: ['portal', 'mobile_app', 'social_media', 'cm_visit', 'mcd311', 'manual', 'whatsapp'], default: 'portal' },
  socialMediaRef: { type: String },

  mcd311TicketId: { type: String },
  mcd311Status: { type: String },
  mcd311LastSync: Date,
  mcd311SyncFailed: { type: Boolean, default: false },

  aiConfidence: { type: Number, min: 0, max: 1 },
  aiSuggestedCategory: { type: String },
  aiSuggestedPriority: { type: String },

  sentimentScore: { type: Number, min: 0, max: 1 },
  sentimentLabel: { type: String, enum: ['neutral', 'concerned', 'frustrated', 'highly_frustrated'] },
  estimatedResolutionHours: { type: Number },

  isDuplicate: { type: Boolean, default: false },
  parentComplaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
  duplicateCount: { type: Number, default: 0 },

  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  upvoteCount: { type: Number, default: 0 },

  adminReminder: { type: Boolean, default: false },

  cmVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'CMVisit' },

  // --- Agentic AI Integration Fields ---
  isComplex: { type: Boolean, default: false },
  agenticReasoning: { type: String },
  humanInterventionRequired: { type: Boolean, default: false },
  escalationReason: { type: String },
  agenticPlan: [{
    taskId: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    taskDescription: { type: String },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'blocked'], default: 'pending' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dependency: { type: String }, // taskId of the task this depends on
    blockReason: { type: String },
    resolutionImages: [{ type: String }],
    completedAt: Date
  }]
}, { timestamps: true });

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ state: 1, department: 1, status: 1 }); // Master query index for RBAC
complaintSchema.index({ state: 1, district: 1 }); // Map heatmap optimization
complaintSchema.index({ status: 1, priority: 1 });
complaintSchema.index({ citizen: 1 });
complaintSchema.index({ assignedTo: 1 });
complaintSchema.index({ department: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ state: 1, createdAt: -1 }); // Fast State Admin Aggregations
complaintSchema.index({ state: 1, department: 1, createdAt: -1 }); // Fast Dept Head Aggregations
complaintSchema.index({ title: 'text', description: 'text' });

// Atomic ticket ID generation — no race condition under concurrent submits
complaintSchema.pre('save', async function (next) {
  try {
    if (this.isNew && !this.ticketId) {
      const seq = await getNextSequence('complaintTicket');
      const stateCode = this.state || 'XX';
      this.ticketId = `GRV-${stateCode}-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
    }
    this.upvoteCount = this.upvotes.length;
    next();
  } catch (err) {
    next(err);
  }
});

complaintSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Complaint', complaintSchema);
