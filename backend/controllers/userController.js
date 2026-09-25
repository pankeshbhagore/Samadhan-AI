const User = require('../models/User');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const Complaint = require('../models/Complaint');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { getStateFilter } = require('../middleware/stateFilter');

exports.getOfficers = asyncHandler(async (req, res) => {
  const { department, state } = req.query;
  const stateFilter = getStateFilter(req.user);
  const query = { role: { $in: ['employee', 'department_head'] }, isActive: true, ...stateFilter };

  if (req.user.role === 'department_head') {
    query.role = 'employee';
  }

  if (department) query.department = department;
  if (req.user.role === 'super_admin' && state) query.state = state;

  const officers = await User.find(query).populate('department', 'name code').select('-password').sort('name');

  const officersWithLoad = officers.map((o) => ({
    ...o.toObject(),
    id: o._id,
    capacityPercent: o.bandwidth > 0 ? Math.round((o.activeComplaints / o.bandwidth) * 100) : 0,
    isFull: o.activeComplaints >= o.bandwidth
  }));

  res.json({ success: true, officers: officersWithLoad });
});

exports.getOfficerPerformance = asyncHandler(async (req, res) => {
  const { state } = req.query;
  const stateFilter = getStateFilter(req.user);
  const query = { role: { $in: ['employee', 'department_head'] }, isActive: true, ...stateFilter };

  if (req.user.role === 'department_head') {
    query.role = 'employee';
  }

  if (req.user.role === 'super_admin' && state) {
    query.state = state;
  }

  const officers = await User.find(query).populate('department', 'name').select('-password').lean();

  const empIds = officers.filter(o => o.role === 'employee').map(o => o._id);
  const deptIds = officers.filter(o => o.role === 'department_head' && o.department).map(o => o.department._id);

  const empStatsAggr = await Complaint.aggregate([
    { $match: { assignedTo: { $in: empIds } } },
    { $group: {
        _id: '$assignedTo',
        totalAssigned: { $sum: 1 },
        totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        activeComplaints: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        avgTime: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$resolutionTimeHours', null] } },
        avgSat: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$verification.satisfactionRating', null] } }
      }
    }
  ]);

  const deptStatsAggr = await Complaint.aggregate([
    { $match: { department: { $in: deptIds } } },
    { $group: {
        _id: '$department',
        totalAssigned: { $sum: 1 },
        totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        activeComplaints: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        avgTime: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$resolutionTimeHours', null] } },
        avgSat: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$verification.satisfactionRating', null] } }
      }
    }
  ]);

  const empStatsMap = {};
  empStatsAggr.forEach(s => { empStatsMap[s._id.toString()] = s; });
  
  const deptStatsMap = {};
  deptStatsAggr.forEach(s => { deptStatsMap[s._id.toString()] = s; });

  const workloadAggr = await User.aggregate([
    { $match: { role: 'employee', department: { $in: deptIds } } },
    { $group: {
        _id: '$department',
        bandwidth: { $sum: '$bandwidth' }
      }
    }
  ]);

  const workloadMap = {};
  workloadAggr.forEach(s => { workloadMap[s._id.toString()] = s; });

  const data = officers.map((o) => {
    let dynStats = { totalAssigned: 0, totalResolved: 0, activeComplaints: 0 };
    let bandwidth = o.bandwidth || 0;

    if (o.role === 'employee') {
      dynStats = empStatsMap[o._id.toString()] || dynStats;
    } else if (o.role === 'department_head' && o.department) {
      dynStats = deptStatsMap[o.department._id.toString()] || dynStats;
      const wl = workloadMap[o.department._id.toString()] || { bandwidth: 0 };
      bandwidth = wl.bandwidth;
    }
    
    let activeComplaints = dynStats.activeComplaints;
    
    const mergedStats = {
      ...(o.stats || {}),
      totalAssigned: dynStats.totalAssigned,
      totalResolved: dynStats.totalResolved,
      avgResolutionHours: dynStats.avgTime ? Math.round(dynStats.avgTime * 10) / 10 : 0,
      avgSatisfactionScore: dynStats.avgSat ? Math.round(dynStats.avgSat * 10) / 10 : 0,
    };

    return {
      id: o._id,
      name: o.name,
      role: o.role,
      department: o.department?.name,
      designation: o.designation,
      stats: mergedStats,
      activeComplaints,
      bandwidth,
      capacityPercent: bandwidth > 0 ? Math.round((activeComplaints / bandwidth) * 100) : 0,
      falseClosureRate: mergedStats.totalAssigned > 0 ? (((mergedStats.falseClosures || 0) / mergedStats.totalAssigned) * 100).toFixed(1) : '0'
    };
  });

  data.sort((a, b) => b.stats.totalResolved - a.stats.totalResolved);

  res.json({ success: true, officers: data });
});

// Full admin user list with filters
exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, search, state, department, page = 1, limit = 20 } = req.query;
  const query = {};
  
  if (req.user.role === 'cm') {
    query.state = req.user.state;
    if (department) query.department = department;
    if (role) {
      query.role = role === 'super_admin' ? { $ne: 'super_admin' } : role;
    } else {
      query.role = { $ne: 'super_admin' };
    }
  } else if (req.user.role === 'department_head') {
    query.state = req.user.state;
    query.department = req.user.department;
    query.role = 'employee';
  } else if (req.user.role === 'super_admin') {
    if (state) query.state = state;
    if (department) query.department = department;
    
    const allowedRoles = ['super_admin', 'cm', 'department_head'];
    if (role && allowedRoles.includes(role)) {
      query.role = role;
    } else {
      query.role = { $in: allowedRoles };
    }
  }
  
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (search) query.$or = [{ name: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }];

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query).populate('department', 'name code').select('-password').sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum)
  ]);

  res.json({ success: true, users, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { email, name, password, phone, role, department, designation, employeeId, bandwidth, ward, district, state } = req.body;
  const existing = await User.findOne({ email: email?.toLowerCase() });
  if (existing) throw new AppError('Email already registered', 400);

  // RBAC for strict hierarchical creation
  const targetState = req.user.role === 'super_admin' ? state : req.user.state;
  let targetDepartment = department;
  let targetRole = role;

  if (req.user.role === 'department_head') {
    targetDepartment = req.user.department;
    targetRole = 'employee';
  } else if (req.user.role === 'cm') {
    targetRole = 'department_head';
    // Department must be provided for department_head
    if (!targetDepartment) throw new AppError('Department is required for Department Head', 400);
  } else if (req.user.role === 'super_admin') {
    targetRole = 'cm';
    targetDepartment = null;
    // State must be provided for State Admin
    if (!targetState) throw new AppError('State is required for State Admin', 400);
  }

  const user = await User.create({ name, email, password, phone, role: targetRole, department: targetDepartment, designation, employeeId, bandwidth, ward, district, state: targetState });
  res.status(201).json({ success: true, user: user.toSafeObject() });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { email, name, phone, role, department, designation, employeeId, bandwidth, ward, district, state, verificationPassword, actionJustification } = req.body;
  
  if (!verificationPassword || !actionJustification || actionJustification.length < 10) {
    throw new AppError('Verification password and justification (min 10 chars) are required', 400);
  }
  const authUser = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(verificationPassword, authUser.password))) {
    throw new AppError('Invalid verification password', 401);
  }

  const updates = { email, name, phone, role, department, designation, employeeId, bandwidth, ward, district, state };
  
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

  const targetUser = await User.findById(req.params.id);
  if (!targetUser) throw new AppError('User not found', 404);

  // Hierarchical scope checks for update
  if (req.user.role === 'department_head') {
    if (targetUser.department?.toString() !== req.user.department?.toString() || targetUser.role !== 'employee') {
      throw new AppError('Department Heads can only edit employees within their own department', 403);
    }
  } else if (req.user.role === 'cm') {
    if (targetUser.state !== req.user.state || targetUser.role === 'super_admin') {
      throw new AppError('State Admins can only edit users within their own state and cannot edit super admins', 403);
    }
  } else if (req.user.role === 'super_admin') {
     // super_admin can do anything, except maybe we prevent them from modifying another super_admin?
     // For now, let super_admin manage all.
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
  await AuditLog.create({
    action: 'USER_UPDATED',
    entityType: 'user', entityId: user._id, performedBy: req.user._id,
    state: user.state,
    details: actionJustification
  });
  
  res.json({ success: true, user });
});

// Deactivate/reactivate — was entirely missing before, meaning admins
// had no way to disable a compromised or departing officer's account
exports.toggleUserActive = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user._id.toString() === req.user._id.toString()) throw new AppError('You cannot deactivate your own account', 400);

  // Hierarchical scope checks
  if (req.user.role === 'department_head') {
    if (user.department?.toString() !== req.user.department?.toString() || user.role !== 'employee') {
      throw new AppError('Department Heads can only deactivate employees within their own department', 403);
    }
  } else if (req.user.role === 'cm') {
    if (user.state !== req.user.state || user.role === 'super_admin') {
      throw new AppError('State Admins can only deactivate users within their own state', 403);
    }
  }

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  await AuditLog.create({
    action: user.isActive ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    entityType: 'user', entityId: user._id, performedBy: req.user._id,
    state: user.state
  });

  res.json({ success: true, user: user.toSafeObject() });
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const { verificationPassword, actionJustification } = req.query; // Usually in body, but this is a DELETE req, sometimes handled via URL or frontend body. To support body in DELETE:
  const pwd = req.body.verificationPassword || verificationPassword;
  const just = req.body.actionJustification || actionJustification;

  if (!pwd || !just || just.length < 10) {
    throw new AppError('Verification password and justification (min 10 chars) are required', 400);
  }
  const authUser = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(pwd, authUser.password))) {
    throw new AppError('Invalid verification password', 401);
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (user._id.toString() === req.user._id.toString()) throw new AppError('You cannot delete your own account', 400);

  // Hierarchical scope checks for delete
  if (req.user.role === 'department_head') {
    if (user.department?.toString() !== req.user.department?.toString() || user.role !== 'employee') {
      throw new AppError('Department Heads can only delete employees within their own department', 403);
    }
  } else if (req.user.role === 'cm') {
    if (user.state !== req.user.state || user.role === 'super_admin') {
      throw new AppError('State Admins can only delete users within their own state', 403);
    }
  }

  // Instead of hard delete, we could soft delete, but user requested full CRUD delete
  await User.findByIdAndDelete(req.params.id);

  await AuditLog.create({
    action: 'USER_DELETED',
    entityType: 'user', entityId: user._id, performedBy: req.user._id,
    state: user.state,
    details: just
  });

  res.json({ success: true, message: 'User deleted successfully' });
});

exports.getDepartments = asyncHandler(async (req, res) => {
  const { state } = req.query;
  const query = { isActive: true };
  if (req.user.role !== 'super_admin' && req.user.state) {
    query.state = req.user.state;
  } else if (state) {
    query.state = state;
  }
  const depts = await Department.find(query).populate('head', 'name email phone').sort('name').lean();

  const deptIds = depts.map(d => d._id);
  const statsAggr = await Complaint.aggregate([
    { $match: { department: { $in: deptIds } } },
    { $group: {
        _id: '$department',
        totalComplaints: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
      }
    }
  ]);
  
  const statsMap = {};
  statsAggr.forEach(s => { statsMap[s._id.toString()] = s; });

  const deptsWithStats = depts.map(d => {
    const s = statsMap[d._id.toString()] || { totalComplaints: 0, resolved: 0 };
    return {
      ...d,
      stats: {
        ...(d.stats || {}),
        totalComplaints: s.totalComplaints,
        resolved: s.resolved
      }
    };
  });

  res.json({ success: true, departments: deptsWithStats });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, head, complaintCategories, contactEmail, contactPhone, mcd311DeptId, slaHours, state } = req.body;
  const deptState = (req.user.role !== 'super_admin' && req.user.state) ? req.user.state : state;
  if (!deptState) throw new AppError('State is required to create a department', 400);
  
  const dept = await Department.create({ name, code, description, head, complaintCategories, contactEmail, contactPhone, mcd311DeptId, slaHours, state: deptState });
  res.status(201).json({ success: true, department: dept });
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, head, complaintCategories, contactEmail, contactPhone, mcd311DeptId, isActive, slaHours, state, verificationPassword, actionJustification } = req.body;
  
  if (!verificationPassword || !actionJustification || actionJustification.length < 10) {
    throw new AppError('Verification password and justification (min 10 chars) are required', 400);
  }
  const authUser = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(verificationPassword, authUser.password))) {
    throw new AppError('Invalid verification password', 401);
  }

  const updates = { name, code, description, head, complaintCategories, contactEmail, contactPhone, mcd311DeptId, isActive, slaHours, state };
  Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
  
  const targetDept = await Department.findById(req.params.id);
  if (!targetDept) throw new AppError('Department not found', 404);

  // Hierarchical scope checks for dept update
  if (req.user.role === 'cm' && targetDept.state !== req.user.state) {
    throw new AppError('State Admins can only edit departments within their own state', 403);
  }

  const dept = await Department.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

  await AuditLog.create({
    action: 'DEPARTMENT_UPDATED',
    entityType: 'department', entityId: dept._id, performedBy: req.user._id,
    state: dept.state,
    details: actionJustification
  });

  res.json({ success: true, department: dept });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const { verificationPassword, actionJustification } = req.query; 
  const pwd = req.body.verificationPassword || verificationPassword;
  const just = req.body.actionJustification || actionJustification;

  if (!pwd || !just || just.length < 10) {
    throw new AppError('Verification password and justification (min 10 chars) are required', 400);
  }
  const authUser = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(pwd, authUser.password))) {
    throw new AppError('Invalid verification password', 401);
  }

  const dept = await Department.findById(req.params.id);
  if (!dept) throw new AppError('Department not found', 404);

  // Hierarchical scope checks for dept delete
  if (req.user.role === 'cm' && dept.state !== req.user.state) {
    throw new AppError('State Admins can only delete departments within their own state', 403);
  }

  // Check if department has active complaints
  const Complaint = require('../models/Complaint');
  const complaintCount = await Complaint.countDocuments({ department: dept._id });
  if (complaintCount > 0) {
    throw new AppError(`Cannot delete department. It is assigned to ${complaintCount} complaints.`, 400);
  }

  await Department.findByIdAndDelete(req.params.id);

  await AuditLog.create({
    action: 'DEPARTMENT_DELETED',
    entityType: 'department', entityId: dept._id, performedBy: req.user._id,
    state: dept.state,
    details: just
  });

  res.json({ success: true, message: 'Department deleted successfully' });
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { suspicious, page = 1, limit = 50 } = req.query;
  const { getStateFilter } = require('../middleware/stateFilter');
  const query = { ...getStateFilter(req.user) };
  if (suspicious === 'true') query.suspicious = true;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, parseInt(limit));

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(query),
    AuditLog.find(query).populate('performedBy', 'name role').sort('-createdAt').skip((pageNum - 1) * limitNum).limit(limitNum)
  ]);

  res.json({ success: true, logs, total });
});

exports.getDepartmentAnalysis = asyncHandler(async (req, res) => {
  const departmentId = req.params.id;
  const dept = await Department.findById(departmentId).populate('head', 'name email phone');
  if (!dept) throw new AppError('Department not found', 404);

  // Enforce state boundaries
  if (req.user.role !== 'super_admin' && req.user.state && dept.state !== req.user.state) {
    throw new AppError('Not authorized to access this department', 403);
  }

  // Get all employee officers in this department
  const officers = await User.find({ department: departmentId, role: 'employee' })
    .select('-password')
    .lean();

  const empIds = officers.map(o => o._id);
  const empStatsAggr = await Complaint.aggregate([
    { $match: { assignedTo: { $in: empIds } } },
    { $group: {
        _id: '$assignedTo',
        totalAssigned: { $sum: 1 },
        totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        activeComplaints: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        avgTime: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$resolutionTimeHours', null] } },
        avgSat: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$verification.satisfactionRating', null] } }
      }
    }
  ]);

  const empStatsMap = {};
  empStatsAggr.forEach(s => { empStatsMap[s._id.toString()] = s; });

  const officersData = officers.map((o) => {
    const dynStats = empStatsMap[o._id.toString()] || { totalAssigned: 0, totalResolved: 0, activeComplaints: 0 };
    const mergedStats = {
      ...(o.stats || {}),
      totalAssigned: dynStats.totalAssigned,
      totalResolved: dynStats.totalResolved,
      avgResolutionHours: dynStats.avgTime ? Math.round(dynStats.avgTime * 10) / 10 : 0,
      avgSatisfactionScore: dynStats.avgSat ? Math.round(dynStats.avgSat * 10) / 10 : 0,
    };
    const activeComplaints = dynStats.activeComplaints;
    const bandwidth = o.bandwidth || 0;

    return {
      id: o._id,
      name: o.name,
      role: o.role,
      designation: o.designation,
      stats: mergedStats,
      activeComplaints,
      bandwidth,
      capacityPercent: bandwidth > 0 ? Math.round((activeComplaints / bandwidth) * 100) : 0,
      falseClosureRate: mergedStats.totalAssigned > 0 ? (((mergedStats.falseClosures || 0) / mergedStats.totalAssigned) * 100).toFixed(1) : '0'
    };
  });
  
  officersData.sort((a,b) => b.stats.totalResolved - a.stats.totalResolved);

  // Get complaint aggregates
  const complaints = await Complaint.aggregate([
    { $match: { department: dept._id } },
    { $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: { $avg: '$resolutionTimeHours' },
        criticalCount: { $sum: { $cond: ['$isCritical', 1, 0] } },
        slaBreaches: { $sum: { $cond: [{ $gt: ['$resolutionTimeHours', dept.slaHours] }, 1, 0] } }
      }
    }
  ]);

  const recentComplaints = await Complaint.find({ department: dept._id })
    .sort('-createdAt')
    .limit(10)
    .populate('citizen', 'name')
    .populate('assignedTo', 'name');

  res.json({
    success: true,
    department: dept,
    officers: officersData,
    complaintStats: complaints,
    recentComplaints
  });
});

exports.getOfficerAnalysis = asyncHandler(async (req, res) => {
  const officerId = req.params.id;
  const officer = await User.findById(officerId).select('-password').populate('department');
  
  if (!officer || !['employee', 'department_head'].includes(officer.role)) {
    throw new AppError('Officer not found', 404);
  }

  // Enforce state boundaries
  if (req.user.role !== 'super_admin' && req.user.state && officer.state !== req.user.state) {
    throw new AppError('Not authorized to access this officer', 403);
  }

  // Compute real stats from complaints dynamically
  const matchCondition = officer.role === 'department_head' ? { department: officer.department._id } : { assignedTo: officer._id };
  
  const aggr = await Complaint.aggregate([
    { $match: matchCondition },
    { $group: {
        _id: null,
        totalAssigned: { $sum: 1 },
        totalResolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        activeComplaints: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
        avgTime: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$resolutionTimeHours', null] } },
        avgSat: { $avg: { $cond: [{ $eq: ['$status', 'resolved'] }, '$verification.satisfactionRating', null] } }
      }
    }
  ]);
  const dynStats = aggr.length > 0 ? aggr[0] : { totalAssigned: 0, totalResolved: 0, activeComplaints: 0, avgTime: 0, avgSat: 0 };
  
  const officerObj = officer.toObject();
  officerObj.stats = {
    ...(officerObj.stats || {}),
    totalAssigned: dynStats.totalAssigned,
    totalResolved: dynStats.totalResolved,
    avgResolutionHours: dynStats.avgTime ? Math.round(dynStats.avgTime * 10) / 10 : 0,
    avgSatisfactionScore: dynStats.avgSat ? Math.round(dynStats.avgSat * 10) / 10 : 0,
  };
  officerObj.activeComplaints = dynStats.activeComplaints;

  if (officer.role === 'department_head') {
    const empAggr = await User.aggregate([
      { $match: { role: 'employee', department: officer.department._id } },
      { $group: {
          _id: null,
          bandwidth: { $sum: '$bandwidth' }
        }
      }
    ]);
    if (empAggr.length > 0) {
      officerObj.bandwidth = empAggr[0].bandwidth;
    } else {
      officerObj.bandwidth = 0;
    }
  }

  // Get recent complaints
  const recentComplaints = await Complaint.find(matchCondition)
    .sort('-createdAt')
    .limit(15)
    .populate('citizen', 'name');

  // Find any AI anomalies for this specific officer
  const { scanOfficerAnomalies } = require('../services/anomalyDetection');
  const allAnomalies = await scanOfficerAnomalies();
  const officerAnomalies = allAnomalies.find(a => a.officer._id.toString() === officerId) || null;

  res.json({
    success: true,
    officer: officerObj,
    recentComplaints,
    anomalies: officerAnomalies
  });
});

