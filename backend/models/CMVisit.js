const mongoose = require('mongoose');

const visitLogSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  address: String,
  ward: String,
  notes: String,
  complaintsReviewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }],
  actionItems: [String],
  photos: [String],
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const cmVisitSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Visit title is required'], trim: true },
  state: { type: String },
  description: String,
  ward: String,
  district: String,
  scheduledDate: Date,
  actualDate: Date,
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  cm: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  logs: [visitLogSchema],
  complaintsIdentified: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }],
  followUpRequired: [String],
  summary: String,
  nearbyComplaints: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }]
}, { timestamps: true });

cmVisitSchema.index({ 'logs.location': '2dsphere' });
cmVisitSchema.index({ status: 1 });

module.exports = mongoose.model('CMVisit', cmVisitSchema);
