const HitlRequest = require('../models/HitlRequest');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { notifyMany, notify } = require('../services/notificationService');
const { sendOfficerAssignedEmail } = require('../services/emailService');

exports.getPendingHitlRequests = async (req, res) => {
  try {
    const filter = { status: 'pending' };
    
    // If getting hitl for a specific complaint
    if (req.query.complaintId) {
      filter.complaintId = req.query.complaintId;
    }

    let requests = await HitlRequest.find(filter)
      .populate('complaintId', 'ticketId title status category department')
      .sort({ createdAt: -1 });

    // Lead Agency Logic: If user is a department head, only show HITLs where their department is the primary lead
    if (req.user.role === 'department_head' && req.user.department) {
      const userDeptId = (req.user.department._id || req.user.department).toString();
      requests = requests.filter(r => {
        if (!r.complaintId || !r.complaintId.department) return false;
        const complaintDeptId = (r.complaintId.department._id || r.complaintId.department).toString();
        return complaintDeptId === userDeptId;
      });
    }

    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resolveHitlRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, modifiedState, adminComments } = req.body;

    const hitlRequest = await HitlRequest.findById(id).populate('complaintId');
    if (!hitlRequest) return res.status(404).json({ error: 'Request not found' });
    if (hitlRequest.status !== 'pending') return res.status(400).json({ error: `Request already ${hitlRequest.status}` });

    // Lead Agency Logic: Check if the department head is authorized for this specific complaint
    if (req.user.role === 'department_head' && req.user.department) {
      const userDeptId = (req.user.department._id || req.user.department).toString();
      const complaintDeptId = (hitlRequest.complaintId.department._id || hitlRequest.complaintId.department).toString();
      if (userDeptId !== complaintDeptId) {
        return res.status(403).json({ error: 'You are not the Primary Lead Agency for this complaint. Only the primary department head can approve this plan.' });
      }
    }

    hitlRequest.status = action === 'approve' ? 'approved' : 'rejected';
    hitlRequest.reviewedBy = req.user._id;
    hitlRequest.reviewedAt = new Date();
    hitlRequest.adminComments = adminComments;
    
    if (action === 'approve' && modifiedState) {
        hitlRequest.proposedAction = modifiedState; // update with human-steered state
    }

    await hitlRequest.save();

    if (action === 'approve') {
      if (hitlRequest.type === 'CREATE_PLAN') {
        const complaint = hitlRequest.complaintId;
        complaint.agenticPlan = hitlRequest.proposedAction;
        complaint.status = 'in_progress';
        complaint.timeline.push({
          status: 'in_progress',
          message: `Agentic Plan approved and executed by ${req.user.name}.`,
          updatedBy: req.user._id
        });
        await complaint.save();

        // Auto-assign and email
        const employees = await User.find({ role: 'employee' }).select('_id department name email');
        
        for (const task of complaint.agenticPlan) {
            if (task.status === 'pending' && !task.assignedTo && task.department) {
                const primaryDeptId = (complaint.department?._id || complaint.department)?.toString();
                let assignedOfficerId = null;

                // 1. If this task is for the primary department and the complaint already has a primary officer assigned
                if (primaryDeptId === task.department.toString() && complaint.assignedTo) {
                    assignedOfficerId = complaint.assignedTo;
                } else {
                    // 2. Intelligent Auto-Assignment (Skill + Load Balancing)
                    const availableOfficers = await User.find({
                        department: task.department,
                        role: 'employee',
                        isActive: true,
                        $expr: { $lt: ['$activeComplaints', '$bandwidth'] }
                    });

                    if (availableOfficers.length > 0) {
                        let bestOfficer = null;
                        let bestScore = Infinity;

                        for (const officer of availableOfficers) {
                            const speedScore = officer.stats?.avgResolutionHours || 24;
                            const loadFactor = 1 + ((officer.activeComplaints || 0) / (officer.bandwidth || 10)); 
                            const finalScore = speedScore * loadFactor;

                            if (finalScore < bestScore) {
                                bestScore = finalScore;
                                bestOfficer = officer;
                            }
                        }
                        if (bestOfficer) assignedOfficerId = bestOfficer._id;
                    }
                }
                
                if (assignedOfficerId) {
                    task.assignedTo = assignedOfficerId;
                    const assignedUser = await User.findById(assignedOfficerId);
                    if (assignedUser) {
                        // Increment load
                        assignedUser.activeComplaints = (assignedUser.activeComplaints || 0) + 1;
                        await assignedUser.save();
                        
                        sendOfficerAssignedEmail(assignedUser.email, assignedUser.name, complaint.ticketId, task.taskDescription).catch(e => console.error(e));
                    }
                }
            }
        }
        
        // Save assignments
        await Complaint.findByIdAndUpdate(complaint._id, { agenticPlan: complaint.agenticPlan });
        req.io.emit('complaint_updated', complaint._id);

      } else if (hitlRequest.type === 'ESCALATION') {
        const complaint = hitlRequest.complaintId;
        complaint.status = 'escalated';
        complaint.timeline.push({
          status: 'escalated',
          message: `Escalation approved by ${req.user.name}: ${adminComments || hitlRequest.contextData.reason}`,
          updatedBy: req.user._id
        });
        await complaint.save();
        req.io.emit('complaint_updated', complaint._id);
        
      } else if (hitlRequest.type === 'MASS_EMAIL') {
        const { sendApprovedMassEmails } = require('../services/cronService');
        sendApprovedMassEmails(hitlRequest.proposedAction).catch(e => console.error(e));
      }
    } else {
        // if rejected
        if (hitlRequest.type === 'CREATE_PLAN') {
            const complaint = hitlRequest.complaintId;
            complaint.status = 'escalated';
            complaint.timeline.push({
              status: 'escalated',
              message: `Agentic Plan rejected by ${req.user.name}. Needs manual assignment.`,
              updatedBy: req.user._id
            });
            await complaint.save();
            req.io.emit('complaint_updated', complaint._id);
        } else if (hitlRequest.type === 'ESCALATION') {
            const complaint = hitlRequest.complaintId;
            complaint.status = 'in_progress';
            complaint.humanInterventionRequired = false;
            complaint.timeline.push({
              status: 'in_progress',
              message: `Escalation rejected by ${req.user.name}. Task remains blocked for department resolution.`,
              updatedBy: req.user._id
            });
            await complaint.save();
            req.io.emit('complaint_updated', complaint._id);
        }
    }

    res.json({ success: true, hitlRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
