const leaveRequestController = require('../controllers/leaveRequestController');
const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

// Route to create a new leave request
router.post('/create', protect, leaveRequestController.createLeaveRequest);
router.get('/get', protect, adminOnly, leaveRequestController.getLeaveRequests);
router.get('/get/:employeeId', protect, adminOnly, leaveRequestController.getLeaveRequestById);
router.get('/me', protect, leaveRequestController.getMyLeaveRequests);
router.put('/update/admin', protect, adminOnly, leaveRequestController.updateLeaveRequestStatus);
router.put('/update/caregiver', protect, leaveRequestController.updateLeaveRequestStatus);
router.put('/update/caregiver/:leaveRequestId', protect, leaveRequestController.updateLeaveRequestCaregiver);
router.get('/check-affected-shifts', protect, adminOnly, leaveRequestController.checkAffectedShifts);

module.exports = router;