const express = require('express');
const router = express.Router();
const { getPendingHitlRequests, resolveHitlRequest } = require('../controllers/hitlController');
const { protect, authorize } = require('../middleware/auth');

// Only allow Admins and CM to interact with HITL (Prevent Dept Heads from approving multi-dept budgets)
router.use(protect);
router.use(authorize('cm', 'super_admin'));

router.get('/pending', getPendingHitlRequests);
router.put('/:id/resolve', resolveHitlRequest);

module.exports = router;
