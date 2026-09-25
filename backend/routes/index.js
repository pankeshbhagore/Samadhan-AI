const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  validate, registerRules, loginRules, changePasswordRules, complaintRules, commentRules, mongoIdParam,
  statusUpdateRules, assignRules, verifyRules
} = require('../middleware/validators');

const authCtrl = require('../controllers/authController');
const complaintCtrl = require('../controllers/complaintController');
const userCtrl = require('../controllers/userController');
const visitCtrl = require('../controllers/visitController');
const notificationCtrl = require('../controllers/notificationController');
const commentCtrl = require('../controllers/commentController');

// ---------- Auth ----------
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/auth/register', registerRules, validate, authCtrl.register);
router.post('/auth/login', loginRules, validate, authCtrl.login);
router.get('/auth/me', protect, authCtrl.getMe);
router.put('/auth/profile', protect, authCtrl.updateProfile);
router.put('/auth/change-password', protect, changePasswordRules, validate, authCtrl.changePassword);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.put('/auth/reset-password/:token', authCtrl.resetPassword);

// ---------- Public tracking (no auth) ----------
router.get('/track/:ticketId', complaintCtrl.trackPublic);

// ---------- States ----------
router.get('/states', (req, res) => {
  const statesData = require('../utils/statesData');
  res.json({ success: true, states: statesData });
});

// ---------- Complaints ----------
/**
 * @swagger
 * /api/complaints:
 *   get:
 *     summary: Retrieve a list of complaints based on RBAC state filtering
 *     tags: [Complaints]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of complaints
 */
router.post('/complaints', protect, upload.array('images', 5), complaintRules, validate, complaintCtrl.submitComplaint);
router.get('/complaints/export', protect, authorize('cm', 'super_admin', 'department_head'), complaintCtrl.exportComplaintsCSV);
router.get('/complaints', protect, complaintCtrl.getComplaints);
router.get('/complaints/nearby', protect, complaintCtrl.getNearbyComplaints);
router.get('/complaints/stats', protect, authorize('cm', 'super_admin', 'department_head'), complaintCtrl.getDashboardStats);
router.get('/complaints/my-stats', protect, authorize('citizen', 'employee', 'department_head'), complaintCtrl.getMyStats);
router.get('/complaints/:id', protect, mongoIdParam(), validate, complaintCtrl.getComplaint);
router.post('/complaints/:id/assign', protect, authorize('cm', 'super_admin', 'department_head'), mongoIdParam(), assignRules, validate, complaintCtrl.assignComplaint);
router.put('/complaints/:id/remind', protect, authorize('cm', 'super_admin'), mongoIdParam(), validate, complaintCtrl.remindDeptHead);
router.put('/complaints/:id/status', protect, authorize('employee', 'department_head', 'super_admin'), mongoIdParam(), upload.array('images', 5), statusUpdateRules, validate, complaintCtrl.updateStatus);
router.post('/complaints/:id/verify', protect, authorize('citizen'), mongoIdParam(), verifyRules, validate, complaintCtrl.citizenVerify);
router.post('/complaints/:id/upvote', protect, mongoIdParam(), validate, complaintCtrl.upvoteComplaint);
router.put('/complaints/:id/subtasks', protect, authorize('employee', 'department_head', 'super_admin', 'cm'), mongoIdParam(), validate, complaintCtrl.updateSubTaskStatus);

// ---------- Comments ----------
router.get('/complaints/:id/comments', protect, mongoIdParam(), validate, commentCtrl.getComments);
router.post('/complaints/:id/comments', protect, mongoIdParam(), commentRules, validate, commentCtrl.addComment);

// ---------- Users / Officers ----------
router.get('/users/officers', protect, authorize('cm', 'super_admin', 'department_head'), userCtrl.getOfficers);
router.get('/users/officers/:id/analysis', protect, authorize('super_admin', 'cm', 'department_head'), userCtrl.getOfficerAnalysis);
router.get('/users/officer-performance', protect, authorize('super_admin', 'cm', 'department_head'), userCtrl.getOfficerPerformance);
router.get('/users', protect, authorize('super_admin', 'cm', 'department_head'), userCtrl.getAllUsers);
router.post('/users', protect, authorize('super_admin', 'cm', 'department_head'), userCtrl.createUser);
router.put('/users/:id', protect, authorize('super_admin', 'cm', 'department_head'), mongoIdParam(), validate, userCtrl.updateUser);
router.delete('/users/:id', protect, authorize('super_admin', 'cm', 'department_head'), mongoIdParam(), validate, userCtrl.deleteUser);
router.put('/users/:id/toggle-active', protect, authorize('super_admin', 'cm', 'department_head'), mongoIdParam(), validate, userCtrl.toggleUserActive);

// ---------- Audit & AI Anomalies ----------
router.get('/audit-logs', protect, authorize('cm', 'super_admin'), userCtrl.getAuditLogs);

router.get('/ai/anomalies', protect, authorize('cm', 'super_admin', 'department_head'), async (req, res) => {
  const { scanOfficerAnomalies, detectDepartmentBottlenecks } = require('../services/anomalyDetection');
  const filter = {};
  if (req.user.role === 'cm') filter.state = req.user.state;
  if (req.user.role === 'department_head') {
    filter.state = req.user.state;
    filter.department = req.user.department;
  }
  if (req.user.role === 'super_admin' && req.query.state) filter.state = req.query.state;
  
  const [officerAnomalies, departmentBottlenecks] = await Promise.all([
    scanOfficerAnomalies(filter),
    detectDepartmentBottlenecks(filter),
  ]);
  res.json({ success: true, officerAnomalies, departmentBottlenecks });
});

// ---------- Reports & AI Generation ----------
router.get('/reports/press-release', protect, authorize('cm', 'super_admin', 'department_head'), require('../controllers/reportController').generatePressRelease);

// ---------- Bot Integrations ----------
router.post('/webhook/whatsapp', require('../controllers/whatsappController').handleWebhook);

// ---------- Departments ----------
router.get('/departments', protect, userCtrl.getDepartments);
router.get('/departments/:id/analysis', protect, userCtrl.getDepartmentAnalysis);
router.post('/departments', protect, authorize('super_admin', 'cm'), userCtrl.createDepartment);
router.put('/departments/:id', protect, authorize('super_admin', 'cm'), mongoIdParam(), validate, userCtrl.updateDepartment);
router.delete('/departments/:id', protect, authorize('super_admin', 'cm'), mongoIdParam(), validate, userCtrl.deleteDepartment);

// ---------- CM Visits ----------
router.post('/visits', protect, authorize('cm', 'super_admin'), visitCtrl.createVisit);
router.get('/visits', protect, authorize('cm', 'super_admin', 'department_head'), visitCtrl.getVisits);
router.get('/visits/:id', protect, mongoIdParam(), validate, visitCtrl.getVisit);
router.put('/visits/:id', protect, authorize('cm', 'super_admin'), mongoIdParam(), validate, visitCtrl.updateVisit);
router.delete('/visits/:id', protect, authorize('cm', 'super_admin'), mongoIdParam(), validate, visitCtrl.deleteVisit);
router.post('/visits/:id/log', protect, authorize('cm', 'super_admin'), mongoIdParam(), validate, visitCtrl.addVisitLog);
router.put('/visits/:id/complete', protect, authorize('cm', 'super_admin'), mongoIdParam(), validate, visitCtrl.completeVisit);

// ---------- Notifications ----------
router.get('/notifications', protect, notificationCtrl.getNotifications);
router.put('/notifications/:id/read', protect, mongoIdParam(), validate, notificationCtrl.markRead);
router.put('/notifications/read-all', protect, notificationCtrl.markAllRead);

// ---------- MCD311 ----------
router.get('/mcd311/status', protect, async (req, res) => {
  const { isApiAvailable } = require('../services/mcd311');
  const available = await isApiAvailable();
  res.json({ success: true, mcd311Available: available, mode: available ? 'live' : 'mock' });
});

module.exports = router;
