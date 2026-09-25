const Comment = require('../models/Comment');
const Complaint = require('../models/Complaint');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { notify } = require('../services/notificationService');

// Mirrors the access rules already enforced in complaintController.getComplaint:
// citizens see only their own complaint, employees only ones assigned to them,
// department heads only within their department, cm/super_admin see everything.
function checkComplaintAccess(req, complaint) {
  const role = req.user.role;
  if (role === 'cm' || role === 'super_admin') return true;
  if (role === 'citizen') return complaint.citizen.toString() === req.user._id.toString();
  if (role === 'employee') return complaint.assignedTo?.toString() === req.user._id.toString();
  if (role === 'department_head') return complaint.department?.toString() === req.user.department?._id?.toString();
  return false;
}

exports.getComments = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!checkComplaintAccess(req, complaint)) throw new AppError('Not authorized to view this complaint', 403);

  const isStaff = ['employee', 'department_head', 'cm', 'super_admin'].includes(req.user.role);
  const query = { complaint: req.params.id };
  if (!isStaff) query.isInternal = false;

  const comments = await Comment.find(query).populate('author', 'name role').sort('createdAt');
  res.json({ success: true, comments });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { message, isInternal } = req.body;
  if (!message?.trim()) throw new AppError('Comment message is required', 400);

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!checkComplaintAccess(req, complaint)) throw new AppError('Not authorized to comment on this complaint', 403);

  const isStaff = ['employee', 'department_head', 'cm', 'super_admin'].includes(req.user.role);
  const isOwner = complaint.citizen.toString() === req.user._id.toString();
  const finalIsInternal = isStaff && Boolean(isInternal);

  const comment = await Comment.create({
    complaint: complaint._id,
    author: req.user._id,
    message: message.trim(),
    isInternal: finalIsInternal
  });

  const populated = await Comment.findById(comment._id).populate('author', 'name role');

  if (!finalIsInternal) {
    if (isStaff && complaint.citizen) {
      await notify(req.io, {
        recipientId: complaint.citizen,
        type: 'general',
        title: 'New update on your complaint',
        message: `${req.user.name} commented on ${complaint.ticketId}`,
        complaintId: complaint._id
      });
    } else if (isOwner && complaint.assignedTo) {
      await notify(req.io, {
        recipientId: complaint.assignedTo,
        type: 'general',
        title: 'Citizen replied',
        message: `${req.user.name} commented on ${complaint.ticketId}`,
        complaintId: complaint._id
      });
    }
  }

  res.status(201).json({ success: true, comment: populated });
});
