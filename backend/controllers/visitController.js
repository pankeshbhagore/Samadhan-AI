const CMVisit = require('../models/CMVisit');
const Complaint = require('../models/Complaint');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { getStateFilter } = require('../middleware/stateFilter');

exports.createVisit = asyncHandler(async (req, res) => {
  const { title, description, ward, district, scheduledDate } = req.body;
  const visit = await CMVisit.create({ title, description, ward, district, scheduledDate, cm: req.user._id, state: req.user.state });
  res.status(201).json({ success: true, visit });
});

exports.getVisits = asyncHandler(async (req, res) => {
  const stateFilter = getStateFilter(req.user);
  const visits = await CMVisit.find(stateFilter)
    .populate('cm', 'name')
    .populate('complaintsIdentified', 'ticketId title status')
    .sort('-createdAt').limit(20);
  res.json({ success: true, visits });
});

exports.getVisit = asyncHandler(async (req, res) => {
  const visit = await CMVisit.findById(req.params.id)
    .populate('cm', 'name')
    .populate('nearbyComplaints')
    .populate('complaintsIdentified');
  if (!visit) throw new AppError('Visit not found', 404);
  res.json({ success: true, visit });
});

exports.addVisitLog = asyncHandler(async (req, res) => {
  const { coordinates, address, ward, notes } = req.body;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new AppError('coordinates must be an array of [lng, lat]', 400);
  }

  const visit = await CMVisit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found', 404);

  const nearby = await Complaint.find({
    location: { $near: { $geometry: { type: 'Point', coordinates }, $maxDistance: 500 } },
    status: { $nin: ['resolved', 'rejected'] }
  }).limit(10).populate('department', 'name');

  visit.logs.push({ location: { type: 'Point', coordinates }, address, ward, notes });
  visit.nearbyComplaints.push(...nearby.map((c) => c._id));
  visit.status = 'in_progress';
  await visit.save();

  res.json({ success: true, visit, nearbyComplaints: nearby });
});

exports.completeVisit = asyncHandler(async (req, res) => {
  const { summary, followUpRequired } = req.body;
  const visit = await CMVisit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found', 404);

  visit.status = 'completed';
  visit.actualDate = new Date();
  if (summary) visit.summary = summary;
  if (followUpRequired) visit.followUpRequired = followUpRequired;
  await visit.save();

  res.json({ success: true, visit });
});

exports.updateVisit = asyncHandler(async (req, res) => {
  const { title, description, ward, district, scheduledDate } = req.body;
  const updates = { title, description, ward, district, scheduledDate };
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
  
  const visit = await CMVisit.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!visit) throw new AppError('Visit not found', 404);
  res.json({ success: true, visit });
});

exports.deleteVisit = asyncHandler(async (req, res) => {
  const visit = await CMVisit.findById(req.params.id);
  if (!visit) throw new AppError('Visit not found', 404);
  await CMVisit.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Visit deleted successfully' });
});
