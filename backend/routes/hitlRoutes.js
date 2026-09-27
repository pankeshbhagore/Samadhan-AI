const express = require('express');
const router = express.Router();
const { getPendingHitlRequests, resolveHitlRequest } = require('../controllers/hitlController');
const { protect, authorize } = require('../middleware/auth');

// Only allow Admins and Department Heads to interact with HITL
router.use(protect);
router.use(authorize('cm', 'super_admin', 'department_head'));

router.get('/pending', getPendingHitlRequests);
router.put('/:id/resolve', resolveHitlRequest);

module.exports = router;
