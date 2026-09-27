const Complaint = require('../models/Complaint');
const Department = require('../models/Department');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getCachedData, setCachedData, invalidateCachePattern } = require('../services/redisService');
const { processImageForFraud } = require('../services/imageFraudService');
const { classifyComplaint, detectDuplicate, calculateSLA } = require('../services/aiClassification');
const { analyzeComplaintAgentically, trackAndCoordinateProgress } = require('../services/agenticCoordinator');
const { syncComplaintToMCD311 } = require('../services/mcd311');
const { notify, notifyMany } = require('../services/notificationService');
const { sendComplaintCreatedEmail, sendComplaintUpdatedEmail } = require('../services/emailService');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { getStateFilter } = require('../middleware/stateFilter');
const { triggerViaSocketWorkflow } = require('../utils/viasocket');

// ---- Submit new complaint ----
exports.submitComplaint = asyncHandler(async (req, res) => {
  const { title, description, address, ward, district, pincode, landmark, coordinates, source, socialMediaRef } = req.body;
  const images = req.files?.map((f) => `/uploads/${f.filename}`) || [];

  const ai = classifyComplaint(title, description);
  const stateFilter = getStateFilter(req.user);
  const userState = req.user.state || 'XX';
  
  const dept = await Department.findOne({ complaintCategories: ai.category, isActive: true, state: userState });

  let location = { type: 'Point', coordinates: [77.2090, 28.6139] }; // Fallback
  if (coordinates) {
    try {
      const parsed = JSON.parse(coordinates);
      if (Array.isArray(parsed) && parsed.length === 2) {
        location = { type: 'Point', coordinates: parsed };
      }
    } catch {
      // invalid coordinates payload — proceed with fallback location
    }
  }

  let isDuplicate = false;
  let parentComplaint = null;
  const duplicate = await detectDuplicate(Complaint, title, description, location);
  if (duplicate) {
    isDuplicate = true;
    parentComplaint = duplicate._id;
    await Complaint.findByIdAndUpdate(duplicate._id, { $inc: { duplicateCount: 1 } });
  }

  const dueHours = calculateSLA(ai.category, ai.priority);
  const dueDate = new Date(Date.now() + dueHours * 60 * 60 * 1000);

  let complaint = await Complaint.create({
    title, description, address, ward, district, pincode, landmark,
    state: userState,
    location,
    category: ai.category,
    priority: ai.isCritical ? 'critical' : ai.priority,
    isCritical: ai.isCritical,
    criticalReason: ai.criticalReason,
    aiConfidence: ai.confidence,
    aiSuggestedCategory: ai.category,
    aiSuggestedPriority: ai.priority,
    department: dept?._id,
    citizen: req.user._id,
    images,
    source: source || 'portal',
    socialMediaRef,
    isDuplicate,
    parentComplaint,
    dueDate,
    sentimentScore: ai.sentiment?.score,
    sentimentLabel: ai.sentiment?.label,
    estimatedResolutionHours: ai.estimatedResolutionHours?.estimatedHours,
    timeline: [{ status: 'submitted', message: 'Complaint submitted successfully', updatedBy: req.user._id }]
  });

  // viaSocket Webhook: Notify that a new complaint was created
  triggerViaSocketWorkflow('COMPLAINT_CREATED', {
    ticketId: complaint.ticketId,
    title: complaint.title,
    category: complaint.category,
    priority: complaint.priority,
    isCritical: complaint.isCritical
  });

  // Background MCD311 sync — never blocks the response
  syncComplaintToMCD311(complaint)
    .then(async (mcdResult) => {
      await Complaint.findByIdAndUpdate(complaint._id, {
        mcd311TicketId: mcdResult.mcd311TicketId,
        mcd311Status: mcdResult.status,
        mcd311LastSync: new Date(),
        mcd311SyncFailed: !mcdResult.success
      });
    })
    .catch((err) => console.error('[MCD311 sync error]', err.message));

  if (dept) {
    await Department.findByIdAndUpdate(dept._id, { $inc: { 'stats.totalComplaints': 1, 'stats.pending': 1 } });
  }

  if (ai.sentiment?.label === 'highly_frustrated' && !complaint.isCritical) {
    const officials = await User.find({ role: { $in: ['cm', 'super_admin'] }, isActive: true, $or: [{ state: null }, { state: userState }] }).select('_id');
    await notifyMany(req.io, officials.map(o => o._id), {
      type: 'high_frustration_alert',
      title: '😤 Highly Frustrated Citizen',
      message: `${complaint.title} — Sentiment score: ${ai.sentiment?.score}`,
      complaintId: complaint._id
    });
  }

  // --- Skill-based Auto Assignment ---
  if (dept) {
    const availableOfficers = await User.find({
      department: dept._id,
      role: 'employee',
      isActive: true,
      $expr: { $lt: ['$activeComplaints', '$bandwidth'] }
    });

    if (availableOfficers.length > 0) {
      let bestOfficer = null;
      let bestScore = Infinity;

      for (const officer of availableOfficers) {
        const catStats = officer.stats.categorySkills?.get(ai.category);
        const speedScore = catStats?.avgResolutionHours || officer.stats.avgResolutionHours || 24;
        const loadFactor = 1 + (officer.activeComplaints / officer.bandwidth); 
        const finalScore = speedScore * loadFactor;

        if (finalScore < bestScore) {
          bestScore = finalScore;
          bestOfficer = officer;
        }
      }

      if (bestOfficer) {
        await User.findByIdAndUpdate(bestOfficer._id, { $inc: { activeComplaints: 1, 'stats.totalAssigned': 1 } });
        complaint.assignedTo = bestOfficer._id;
        complaint.assignedAt = new Date();
        complaint.status = 'assigned';
        complaint.timeline.push({ status: 'assigned', message: `Auto-assigned to ${bestOfficer.name} based on skill metrics`, isAutomatic: true, updatedBy: null });
        
        await notify(req.io, {
          recipientId: bestOfficer._id,
          type: 'new_assignment',
          title: 'New Complaint Auto-Assigned',
          message: `${complaint.ticketId}: ${complaint.title}`,
          complaintId: complaint._id
        });
      }
    }
  }

  await complaint.save();

  // Run Agentic AI Coordination Analysis
  const agenticResult = await analyzeComplaintAgentically(complaint._id);
  // Re-fetch to avoid overwriting agenticPlan saved by the coordinator
  const freshComplaint = await Complaint.findById(complaint._id);
  if (agenticResult && agenticResult.isComplex) {
    if (agenticResult.humanInterventionRequired) {
      const officials = await User.find({ role: { $in: ['cm', 'super_admin'] }, isActive: true, $or: [{ state: null }, { state: userState }] }).select('_id');
      await notifyMany(req.io, officials.map((o) => o._id), {
        type: 'agentic_escalation',
        title: '🤖 Agentic AI Escalation',
        message: `Human intervention required for: ${agenticResult.ticketId}`,
        complaintId: agenticResult._id
      });
    } else {
      freshComplaint.timeline.push({ status: 'in_progress', message: 'Agentic AI generated a multi-department resolution plan.', isAutomatic: true, updatedBy: null });
      await freshComplaint.save();
    }
    // Use freshComplaint for all subsequent operations
    complaint = freshComplaint;

    // --- Notify ALL department officers & heads involved in the agentic plan ---
    const involvedDeptIds = [...new Set(
      (complaint.agenticPlan || [])
        .map(t => t.department?.toString())
        .filter(Boolean)
    )];
    
    if (involvedDeptIds.length > 0) {
      // Find department heads and employees in ALL involved departments
      const deptStaff = await User.find({
        department: { $in: involvedDeptIds },
        role: { $in: ['employee', 'department_head'] },
        isActive: true,
        state: userState
      }).select('_id role department');

      // Send personalized notification to each staff member
      for (const staff of deptStaff) {
        // Find which task(s) belong to this staff's department
        const theirTasks = complaint.agenticPlan.filter(
          t => t.department?.toString() === staff.department?.toString()
        );
        const taskDescriptions = theirTasks.map(t => t.taskDescription).join('; ');

        await notify(req.io, {
          recipientId: staff._id,
          type: 'agentic_task_assigned',
          title: '🤖 New Agentic AI Task For Your Department',
          message: `${complaint.ticketId}: ${taskDescriptions}`,
          complaintId: complaint._id
        });
      }
    }
  }

  // Real-time + persisted notifications to CM/admins for critical complaints
  if (complaint.isCritical) {
    const officials = await User.find({ role: { $in: ['cm', 'super_admin'] }, isActive: true, $or: [{ state: null }, { state: userState }] }).select('_id');
    await notifyMany(req.io, officials.map((o) => o._id), {
      type: 'critical_complaint',
      title: '🚨 Critical Complaint Reported',
      message: `${complaint.title} — ${complaint.address}`,
      complaintId: complaint._id
    });
    req.io?.emit('critical_complaint', {
      id: complaint._id, ticketId: complaint.ticketId, title: complaint.title,
      address: complaint.address, criticalReason: complaint.criticalReason
    });
  }
  req.io?.emit('new_complaint', { ticketId: complaint.ticketId, category: complaint.category });

  // Send Email to Citizen
  sendComplaintCreatedEmail(req.user.email, complaint.ticketId, complaint.title).catch(err => console.error(err));

  const populated = await Complaint.findById(complaint._id)
    .populate('citizen', 'name email')
    .populate('department', 'name')
    .populate('agenticPlan.department', 'name'); // Populate AI plan depts
  res.status(201).json({ success: true, complaint: populated });
});

// ---- List complaints (role-filtered) ----
exports.getComplaints = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, category, priority, department, ward, search, sort = '-createdAt', state, sentiment, hasDuplicates, isCritical } = req.query;
  const stateFilter = getStateFilter(req.user);
  const query = { ...stateFilter };

  if (req.user.role === 'super_admin' && state) {
    query.state = state;
  }

  // Apply explicit filters (which were previously missing)
  if (status) query.status = status.includes(',') ? { $in: status.split(',') } : status;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (req.query.assignedTo) {
    query.assignedTo = req.query.assignedTo === 'me' ? req.user._id : req.query.assignedTo;
  }

  // Handle assignedTo and department filtering via stateFilter instead of manually,
  // except for explicit overrides like admin filtering by department.
  if (department && ['cm', 'super_admin'].includes(req.user.role)) query.department = department;
  if (ward) query.ward = ward;
  if (search) {
    const searchVal = search.trim();
    if (searchVal.toUpperCase().startsWith('GRV') || /^\d+$/.test(searchVal) || /^[A-Z]{2}-\d{4}/i.test(searchVal)) {
      query.ticketId = { $regex: searchVal, $options: 'i' };
    } else {
      query.$text = { $search: searchVal };
    }
  }

  if (sentiment) {
    if (sentiment === 'Angry') {
      query.status = { $ne: 'resolved' };
      query.sentimentLabel = { $in: ['highly_frustrated', 'frustrated'] };
    } else if (sentiment === 'Positive') {
      query.status = 'resolved';
    } else if (sentiment === 'Neutral') {
      query.status = { $ne: 'resolved' };
      query.sentimentLabel = { $nin: ['highly_frustrated', 'frustrated'] };
    }
  }
  if (hasDuplicates === 'true') query.duplicateCount = { $gt: 0 };
  if (isCritical === 'true') query.isCritical = true;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(10000, Math.max(1, parseInt(limit)));

  const [total, complaints] = await Promise.all([
    Complaint.countDocuments(query),
    Complaint.find(query)
      .populate('citizen', 'name phone')
      .populate('assignedTo', 'name designation')
      .populate('department', 'name code')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
  ]);

  res.json({
    success: true,
    complaints,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
});

// ---- Single complaint ----
exports.getComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate('citizen', 'name email phone ward')
    .populate('assignedTo', 'name designation phone')
    .populate('assignedBy', 'name')
    .populate('department', 'name code contactEmail contactPhone')
    .populate('timeline.updatedBy', 'name role')
    .populate('agenticPlan.department', 'name')
    .populate('agenticPlan.assignedTo', 'name');

  if (!complaint) throw new AppError('Complaint not found', 404);

  const isOwner = complaint.citizen?._id?.toString() === req.user._id.toString();
  const isAssignee = complaint.assignedTo?._id?.toString() === req.user._id.toString();
  const isPrivileged = ['cm', 'super_admin', 'department_head'].includes(req.user.role);

  if (req.user.role === 'citizen' && !isOwner) throw new AppError('Not authorized to view this complaint', 403);
  
  if (req.user.role === 'employee' && !isAssignee) {
    const empDept = req.user.department?._id?.toString() || req.user.department?.toString();
    const hasDeptSubTask = complaint.agenticPlan?.some(
      t => (t.department?._id?.toString() || t.department?.toString()) === empDept
    );
    const hasAssignedSubTask = complaint.agenticPlan?.some(
      t => (t.assignedTo?._id?.toString() || t.assignedTo?.toString()) === req.user._id.toString()
    );
    if (!hasDeptSubTask && !hasAssignedSubTask) throw new AppError('Not authorized to view this complaint', 403);
  }
  
  if (req.user.role === 'department_head') {
    const headDept = req.user.department?._id?.toString() || req.user.department?.toString();
    const isPrimaryDept = complaint.department?._id?.toString() === headDept;
    const hasSubTask = complaint.agenticPlan?.some(
      t => (t.department?._id?.toString() || t.department?.toString()) === headDept
    );
    if (!isPrimaryDept && !hasSubTask) throw new AppError('Not authorized to view this complaint', 403);
  }

  res.json({ success: true, complaint });
});

// Public tracking — no authentication required, intentionally exposes only
// non-sensitive fields (no citizen contact info, no officer phone numbers,
// no internal notes) so a tracking link can be safely shared with anyone.
exports.trackPublic = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findOne({ ticketId: req.params.ticketId })
    .populate('department', 'name')
    .select('ticketId title category priority status address ward district createdAt resolvedAt dueDate isCritical timeline upvoteCount');

  if (!complaint) throw new AppError('No complaint found with this ticket ID', 404);

  const safeTimeline = complaint.timeline.map((t) => ({ status: t.status, message: t.message, timestamp: t.timestamp }));

  res.json({
    success: true,
    complaint: {
      ticketId: complaint.ticketId,
      title: complaint.title,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      address: complaint.address,
      ward: complaint.ward,
      district: complaint.district,
      department: complaint.department?.name,
      isCritical: complaint.isCritical,
      createdAt: complaint.createdAt,
      resolvedAt: complaint.resolvedAt,
      dueDate: complaint.dueDate,
      upvoteCount: complaint.upvoteCount,
      timeline: safeTimeline
    }
  });
});

// ---- Assign to officer ----
exports.remindDeptHead = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (complaint.status === 'resolved') throw new AppError('Complaint already resolved', 400);
  
  if (!['cm', 'super_admin'].includes(req.user.role)) {
    throw new AppError('Not authorized to send admin reminders', 403);
  }

  complaint.adminReminder = true;
  await complaint.save();

  await AuditLog.create({
    action: 'ADMIN_REMINDER_SENT',
    entityType: 'complaint', entityId: complaint._id, performedBy: req.user._id,
    state: complaint.state
  });

  res.json({ success: true, message: 'Department Head notified successfully' });
});

exports.assignComplaint = asyncHandler(async (req, res) => {
  const { officerId, note } = req.body;
  if (!officerId) throw new AppError('officerId is required', 400);

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (complaint.status === 'resolved') throw new AppError('Cannot reassign a resolved complaint', 400);

  const officer = await User.findById(officerId);
  if (!officer || !['employee', 'department_head'].includes(officer.role)) {
    throw new AppError('Selected user is not a valid officer', 400);
  }
  if (!officer.isActive) throw new AppError('Officer account is deactivated', 400);

  if (officer.activeComplaints >= officer.bandwidth) {
    throw new AppError(`Officer at full capacity (${officer.activeComplaints}/${officer.bandwidth})`, 400);
  }

  const previousOfficerId = complaint.assignedTo;
  if (previousOfficerId && previousOfficerId.toString() !== officerId) {
    await User.findByIdAndUpdate(previousOfficerId, { $inc: { activeComplaints: -1 } });
  }
  if (!previousOfficerId || previousOfficerId.toString() !== officerId) {
    await User.findByIdAndUpdate(officerId, { $inc: { activeComplaints: 1, 'stats.totalAssigned': 1 } });
  }

  complaint.assignedTo = officerId;
  complaint.assignedBy = req.user._id;
  complaint.assignedAt = new Date();
  complaint.status = 'assigned';
  complaint.adminReminder = false;
  complaint.timeline.push({ status: 'assigned', message: note || `Assigned to ${officer.name}`, updatedBy: req.user._id });
  await complaint.save();

  await notify(req.io, {
    recipientId: officerId,
    type: 'new_assignment',
    title: 'New Complaint Assigned',
    message: `${complaint.ticketId}: ${complaint.title}`,
    complaintId: complaint._id
  });

  await AuditLog.create({ action: 'ASSIGN', entityType: 'complaint', entityId: complaint._id, performedBy: req.user._id, details: { officerId }, state: complaint.state });

  // Send Email to Citizen about assignment
  const citizen = await User.findById(complaint.citizen);
  if (citizen && citizen.email) {
    sendComplaintUpdatedEmail(
      citizen.email, 
      complaint.ticketId, 
      'Assigned', 
      `Your complaint has been assigned to an officer for resolution.`
    ).catch(err => console.error(err));
  }

  res.json({ success: true, complaint });
});

// ---- Update status (officer/admin) ----
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, note, resolutionNote, latitude, longitude } = req.body;
  if (!status) throw new AppError('status is required', 400);

  const VALID_STATUSES = ['under_review', 'in_progress', 'pending_verification', 'escalated', 'rejected'];
  if (!VALID_STATUSES.includes(status)) throw new AppError('Invalid status value', 400);

  const images = req.files?.map((f) => `/uploads/${f.filename}`) || [];
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);

  // Run Fraud Detection on uploaded images
  const proofImageHashes = [];
  for (const imgPath of images) {
    const { hash } = await processImageForFraud(imgPath, complaint._id, req.user._id, req.io);
    if (hash) proofImageHashes.push(hash);
  }

  if (complaint.assignedTo?.toString() !== req.user._id.toString()) {
    throw new AppError('Only the assigned officer can update the operational status', 403);
  }
  if (['resolved', 'rejected'].includes(complaint.status)) {
    throw new AppError('Complaint is already closed', 400);
  }

  complaint.timeline.push({ status, message: note || `Status updated to ${status}`, updatedBy: req.user._id, proofImages: images });

  if (status === 'in_progress' && images.length > 0) {
    complaint.resolutionImages.push(...images);
  }

  if (status === 'pending_verification') {
    complaint.status = 'pending_verification';
    complaint.resolutionNote = resolutionNote;
    complaint.resolutionImages.push(...images);
    
    const existingHashes = complaint.verification?.proofImageHashes || [];
    complaint.verification = { 
      requestedAt: new Date(), 
      citizenConfirmed: null, 
      proofImageHashes: [...existingHashes, ...proofImageHashes] 
    };

    // Geo-fence SLA Tracking (Contractor Accountability)
    if (latitude && longitude && complaint.location && complaint.location.coordinates) {
      const [cLng, cLat] = complaint.location.coordinates;
      const R = 6371e3; // Earth radius in meters
      const rad = Math.PI / 180;
      const dLat = (latitude - cLat) * rad;
      const dLng = (longitude - cLng) * rad;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(cLat * rad) * Math.cos(latitude * rad) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceMeters = R * c;

      if (distanceMeters > 300) { // 300 meters threshold
        await AuditLog.create({
          action: 'GEO_FENCE_VIOLATION',
          entityType: 'complaint',
          entityId: complaint._id,
          performedBy: req.user._id,
          suspicious: true,
          suspicionReason: `Officer resolved complaint from ${Math.round(distanceMeters)}m away.`,
          details: { distanceMeters, officerLat: latitude, officerLng: longitude },
          state: complaint.state
        });
        
        req.io?.emit('false_closure_alert', {
          complaint: { id: complaint._id, ticketId: complaint.ticketId, title: complaint.title },
          officerId: req.user._id,
          reason: `Resolution submitted from ${Math.round(distanceMeters)}m away (Geo-fence violation)`
        });
      }
    }

    await notify(req.io, {
      recipientId: complaint.citizen,
      type: 'verification_required',
      title: 'Please verify your complaint resolution',
      message: `Officer marked "${complaint.title}" as resolved. Please confirm.`,
      complaintId: complaint._id
    });
    
    // Fetch citizen email and send email update
    const citizen = await User.findById(complaint.citizen);
    if (citizen && citizen.email) {
      sendComplaintUpdatedEmail(
        citizen.email, 
        complaint.ticketId, 
        'Pending Verification', 
        `Officer marked "${complaint.title}" as resolved. Please click the tracking link to verify the resolution.`,
        { resolutionNote, resolutionImages: complaint.resolutionImages }
      ).catch(err => console.error(err));
    }

    // Suspicious: marked for verification with zero proof images ever attached
    if (images.length === 0 && complaint.resolutionImages.length === 0) {
      await AuditLog.create({
        action: 'SUSPICIOUS_CLOSURE', entityType: 'complaint', entityId: complaint._id,
        performedBy: req.user._id, suspicious: true,
        suspicionReason: 'Sent for verification without any proof images',
        state: complaint.state
      });
    }
  } else {
    complaint.status = status;
    // Send standard status update email
    const citizen = await User.findById(complaint.citizen);
    if (citizen && citizen.email) {
      sendComplaintUpdatedEmail(
        citizen.email, 
        complaint.ticketId, 
        status, 
        note || `Status has been updated to ${status}`
      ).catch(err => console.error(err));
    }
  }

  await complaint.save();
  req.io?.emit('complaint_updated', { ticketId: complaint.ticketId, status: complaint.status });

  res.json({ success: true, complaint });
});

// ---- Citizen verification (anti-false-closure core feature) ----
exports.citizenVerify = asyncHandler(async (req, res) => {
  const { confirmed, feedback, rating, rejectionReason } = req.body;
  if (typeof confirmed !== 'boolean') throw new AppError('confirmed (boolean) is required', 400);

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);
  if (complaint.citizen.toString() !== req.user._id.toString()) throw new AppError('Not authorized', 403);
  if (complaint.status !== 'pending_verification') throw new AppError('This complaint is not awaiting verification', 400);

  if (!complaint.verification) {
    complaint.verification = {};
  }

  complaint.verification.respondedAt = new Date();
  complaint.verification.citizenConfirmed = confirmed;
  complaint.verification.citizenFeedback = feedback;

  if (confirmed) {
    if (!rating || rating < 1 || rating > 5) throw new AppError('A rating from 1-5 is required to confirm resolution', 400);
    complaint.verification.satisfactionRating = rating;
    complaint.status = 'resolved';
    complaint.resolvedAt = new Date();
    complaint.resolutionTimeHours = Math.max(1, Math.ceil((complaint.resolvedAt - complaint.createdAt) / 3600000));
    complaint.timeline.push({ status: 'resolved', message: `Citizen confirmed resolution. Rating: ${rating}/5`, updatedBy: req.user._id });

    if (complaint.assignedTo) {
      const officer = await User.findById(complaint.assignedTo);
      if (officer) {
        officer.activeComplaints = Math.max(0, officer.activeComplaints - 1);
        officer.stats.totalResolved += 1;
        await officer.save({ validateBeforeSave: false });
        await officer.addRating(rating);
        await officer.addResolutionTime(complaint.resolutionTimeHours, complaint.category);
      }
    }
    if (complaint.department) {
      const dept = await Department.findByIdAndUpdate(complaint.department, {
        $inc: { 'stats.resolved': 1, 'stats.pending': -1, 'stats.sumResolutionHours': complaint.resolutionTimeHours }
      }, { new: true });
      if (dept && dept.stats.resolved > 0) {
        dept.stats.avgResolutionHours = parseFloat((dept.stats.sumResolutionHours / dept.stats.resolved).toFixed(1));
        await dept.save();
      }
    }
    
    // Send email for Resolution
    const citizen = await User.findById(complaint.citizen);
    if (citizen && citizen.email) {
      sendComplaintUpdatedEmail(
        citizen.email, 
        complaint.ticketId, 
        'Resolved', 
        `You have confirmed the resolution. Thank you for using Samadhan!`,
        { resolutionTimeHours: complaint.resolutionTimeHours }
      ).catch(err => console.error(err));
    }
    
  } else {
    if (!rejectionReason?.trim()) throw new AppError('Please explain why the resolution is rejected', 400);
    complaint.status = 'reopened';
    complaint.reopenCount += 1;
    complaint.verification.rejectionReason = rejectionReason;
    complaint.verification.escalatedAfterRejection = true;
    complaint.timeline.push({
      status: 'reopened',
      message: `⚠️ Citizen REJECTED resolution. Reason: ${rejectionReason}. Auto-escalated.`,
      updatedBy: req.user._id
    });

    if (complaint.assignedTo) {
      await User.findByIdAndUpdate(complaint.assignedTo, { $inc: { 'stats.falseClosures': 1 } });
    }

    await AuditLog.create({
      action: 'FALSE_CLOSURE_DETECTED', entityType: 'complaint', entityId: complaint._id,
      performedBy: complaint.assignedTo, suspicious: true, suspicionReason: `Citizen rejected: ${rejectionReason}`
    });

    const officials = await User.find({ role: { $in: ['cm', 'super_admin', 'department_head'] }, isActive: true }).select('_id');
    await notifyMany(req.io, officials.map((o) => o._id), {
      type: 'false_closure_alert',
      title: '⚠️ False Closure Detected',
      message: `${complaint.ticketId} rejected by citizen: ${rejectionReason}`,
      complaintId: complaint._id
    });
    req.io?.emit('false_closure_alert', { complaint: { id: complaint._id, ticketId: complaint.ticketId, title: complaint.title }, officerId: complaint.assignedTo, reason: rejectionReason });
    
    // Send email for Reopening
    const citizen = await User.findById(complaint.citizen);
    if (citizen && citizen.email) {
      sendComplaintUpdatedEmail(
        citizen.email, 
        complaint.ticketId, 
        'Reopened / Escalated', 
        `You rejected the resolution. Your complaint has been reopened and escalated to higher authorities.`
      ).catch(err => console.error(err));
    }
  }

  await complaint.save();
  res.json({ success: true, complaint, message: confirmed ? 'Thank you for confirming!' : 'Complaint reopened and escalated.' });
});

// ---- Upvote / un-upvote ----
exports.upvoteComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new AppError('Complaint not found', 404);

  const userId = req.user._id.toString();
  const alreadyVoted = complaint.upvotes.some((u) => u.toString() === userId);

  if (alreadyVoted) complaint.upvotes = complaint.upvotes.filter((u) => u.toString() !== userId);
  else complaint.upvotes.push(req.user._id);

  await complaint.save();
  res.json({ success: true, upvoted: !alreadyVoted, upvoteCount: complaint.upvoteCount });
});

// ---- Nearby (for CM visits / map) ----
exports.getNearbyComplaints = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 1000, status } = req.query;
  if (!lat || !lng) throw new AppError('lat and lng query params are required', 400);
  
  const stateFilter = getStateFilter(req.user);

  const query = {
    ...stateFilter,
    location: {
      $near: { $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }, $maxDistance: parseInt(radius) }
    }
  };
  if (status) query.status = status;

  const complaints = await Complaint.find(query)
    .populate('citizen', 'name')
    .populate('assignedTo', 'name')
    .populate('department', 'name')
    .limit(50);

  res.json({ success: true, complaints, total: complaints.length });
});

// ---- Dashboard analytics ----
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const { days, state } = req.query;
  const hasRange = days !== undefined && days !== '';
  const numDays = hasRange ? parseInt(days, 10) : null;
  const stateQueryStr = state || 'all';
  const cacheKey = `dashboardStats:${req.user._id}:${hasRange ? numDays : 'all'}:${stateQueryStr}`;

  const cachedStats = await getCachedData(cacheKey);
  if (cachedStats) {
    return res.json({ success: true, stats: cachedStats, cached: true });
  }

  // days=0 -> since midnight today; days=N -> last N days; omitted/empty -> all time
  const stateFilter = getStateFilter(req.user);
  if (req.user.role === 'super_admin' && state) {
    stateFilter.state = state;
  }
  const mongoose = require('mongoose');
  if (req.user.role === 'department_head' && req.user.department) {
    stateFilter.department = new mongoose.Types.ObjectId(req.user.department);
  }
  
  let rangeFilter = { ...stateFilter };
  if (hasRange && !Number.isNaN(numDays)) {
    const since = numDays === 0
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : new Date(Date.now() - numDays * 24 * 60 * 60 * 1000);
    rangeFilter.createdAt = { $gte: since };
  }

  // Trend chart window: same as the selected range, but always at least 1 day
  // wide so a single day's bucket is still visible, capped at 90 for the chart.
  const trendWindowDays = hasRange && !Number.isNaN(numDays) ? Math.min(Math.max(numDays, 1), 90) : 7;
  const trendSince = new Date(Date.now() - trendWindowDays * 24 * 60 * 60 * 1000);

  const [statusCounts, categoryCounts, priorityCounts, recentCritical, topDepts, trend, falseClosures, overdueCount] = await Promise.all([
    Complaint.aggregate([{ $match: rangeFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Complaint.aggregate([{ $match: rangeFilter }, { $group: { _id: '$category', count: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Complaint.aggregate([{ $match: rangeFilter }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Complaint.find({ isCritical: true, status: { $nin: ['resolved'] }, ...stateFilter }).sort('-createdAt').limit(5).populate('department', 'name'),
    Complaint.aggregate([
      { $match: rangeFilter },
      { $group: { _id: '$department', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } },
      { $sort: { total: -1 } }, { $limit: 5 },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } }
    ]),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: trendSince }, ...stateFilter } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    AuditLog.countDocuments({ action: 'FALSE_CLOSURE_DETECTED', ...(rangeFilter.createdAt ? { createdAt: rangeFilter.createdAt } : {}) }),
    Complaint.countDocuments({ dueDate: { $lt: new Date() }, status: { $nin: ['resolved', 'rejected'] }, ...rangeFilter })
  ]);

  const total = statusCounts.reduce((a, b) => a + b.count, 0);
  const resolved = statusCounts.find((s) => s._id === 'resolved')?.count || 0;
  const critical = priorityCounts.find((p) => p._id === 'critical')?.count || 0;
  const pending = statusCounts.filter((s) => !['resolved', 'rejected'].includes(s._id)).reduce((a, b) => a + b.count, 0);

  const stats = {
    total, resolved, critical, pending,
    resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : '0',
    falseClosures, overdueCount,
    statusCounts, categoryCounts, priorityCounts, recentCritical, topDepts, trend,
    rangeDays: hasRange ? numDays : null
  };

  // Cache for 5 minutes
  await setCachedData(cacheKey, stats, 300);

  res.json({
    success: true,
    stats,
    cached: false
  });
});

// ---- Get My Personal/Employee Accurate Stats ----
exports.getMyStats = asyncHandler(async (req, res) => {
  const query = {};
  if (req.user.role === 'citizen') query.citizen = req.user._id;
  if (req.user.role === 'employee') query.assignedTo = req.user._id;
  if (req.user.role === 'department_head') {
    query.department = req.user.department;
    if (req.user.state) query.state = req.user.state;
  }

  const [total, resolved, critical] = await Promise.all([
    Complaint.countDocuments(query),
    Complaint.countDocuments({ ...query, status: 'resolved' }),
    Complaint.countDocuments({ ...query, isCritical: true }),
  ]);

  res.json({
    success: true,
    stats: {
      total,
      resolved,
      critical,
      pending: total - resolved
    }
  });
});

// ---- Export complaints to CSV (Admin/CM only) ----
exports.exportComplaintsCSV = asyncHandler(async (req, res) => {
  const { status, category, department, state } = req.query;
  const stateFilter = getStateFilter(req.user);
  const query = { ...stateFilter };

  if (req.user.role === 'super_admin' && state) {
    query.state = state;
  }
  if (department && ['cm', 'super_admin'].includes(req.user.role)) query.department = department;
  if (status) query.status = status;
  if (category) query.category = category;

  const complaints = await Complaint.find(query)
    .populate('citizen', 'name email phone')
    .populate('assignedTo', 'name')
    .populate('department', 'name')
    .sort('-createdAt');

  const { Parser } = require('json2csv');
  const fields = [
    'ticketId', 'title', 'category', 'status', 'priority', 'isCritical', 
    'state', 'address', 'ward', 'department.name', 'citizen.name', 'assignedTo.name',
    'createdAt', 'resolvedAt', 'resolutionTimeHours'
  ];
  const opts = { fields };
  
  try {
    const parser = new Parser(opts);
    const csv = parser.parse(complaints);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=complaints_export.csv');
    res.status(200).end(csv);
  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate CSV' });
  }
});

// ---- Update Agentic Sub-Task Status ----
exports.updateSubTaskStatus = asyncHandler(async (req, res) => {
  const { taskId, status, assignedTo, blockReason } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) throw new AppError('Complaint not found', 404);
  if (!complaint.isComplex || !complaint.agenticPlan) {
    throw new AppError('This is not a complex agentic complaint', 400);
  }

  const task = complaint.agenticPlan.find(t => t.taskId === taskId);
  if (!task) throw new AppError('Sub-task not found', 404);

  // --- RBAC Authorization Checks ---
  const isSuperAdmin = req.user.role === 'super_admin';
  const isCM = req.user.role === 'cm' && (!req.user.state || req.user.state === complaint.state);
  
  // Normalize department IDs for comparison (handles both populated objects and raw ObjectIds)
  const userDept = (req.user.department?._id || req.user.department)?.toString();
  const taskDept = (task.department?._id || task.department)?.toString();
  
  const isDeptHead = req.user.role === 'department_head' && 
                     userDept === taskDept &&
                     (!req.user.state || req.user.state === complaint.state);
                     
  // Employees can only update if they are in the department responsible for this specific sub-task
  const isEmployeeInDept = req.user.role === 'employee' && userDept === taskDept;

  if (!isSuperAdmin && !isCM && !isDeptHead && !isEmployeeInDept) {
    throw new AppError('You are not authorized to update this specific department\'s sub-task.', 403);
  }
  // ---------------------------------

  if (status) {
    if (status === 'in_progress' && task.dependency) {
      const depTask = complaint.agenticPlan.find(t => t.taskId === task.dependency);
      if (depTask && depTask.status !== 'completed') {
        throw new AppError(`Cannot start this task yet. It depends on ${task.dependency} which is not completed.`, 400);
      }
    }

    task.status = status;
    if (status === 'completed') {
      const images = req.files ? req.files.map(f => `/uploads/complaints/${f.filename}`) : [];
      if (images.length === 0) {
        throw new AppError('Proof of work (images) is required to mark a sub-task as completed', 400);
      }
      task.resolutionImages = images;
      task.completedAt = new Date();
    }
    
    // Auto-assign task to the employee who starts it if not already assigned
    if (status === 'in_progress' && !task.assignedTo && req.user.role === 'employee') {
      task.assignedTo = req.user._id;
    }
  }

  if (assignedTo) {
    task.assignedTo = assignedTo;
  }

  if (status === 'blocked' && blockReason) {
    task.blockReason = blockReason;
    // viaSocket Webhook: Notify that an agentic task is blocked
    triggerViaSocketWorkflow('ESCALATION_ALERT', {
      ticketId: complaint.ticketId,
      taskId,
      blockReason
    });
  }

  await complaint.save();

  // Call the coordinator to check if next tasks need unblocking, or if the whole thing is done
  const { trackAndCoordinateProgress, replanComplaintAgentically } = require('../services/agenticCoordinator');
  if (status === 'blocked') {
    await replanComplaintAgentically(complaint._id, taskId, blockReason || "No reason provided");
  } else {
    await trackAndCoordinateProgress(complaint._id);
  }

  const updatedComplaint = await Complaint.findById(complaint._id)
    .populate('agenticPlan.department', 'name')
    .populate('agenticPlan.assignedTo', 'name');

  req.io?.emit('complaint_updated', { ticketId: updatedComplaint.ticketId, status: updatedComplaint.status });

  res.json({ success: true, complaint: updatedComplaint, message: 'Sub-task updated successfully' });
});
