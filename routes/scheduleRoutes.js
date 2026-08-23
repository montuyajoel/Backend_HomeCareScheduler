const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

const {
    assignScheduleToCaregiver,
    getMySchedules,
    getSchedulesForCaregiver,
    getSchedulesByDate,
    getAvailableCaregivers,
    validateScheduleAssignment,
    updateSchedule,
    cancelSchedule,
    reassignSchedule,
    getAvailableCaregiversBatch,
    validateScheduleAssignmentBatch,
    assignScheduleBatch,
} = require("../controllers/scheduleController");

router.post("/assign", protect, adminOnly, assignScheduleToCaregiver);
router.post("/assign-batch", protect, adminOnly, assignScheduleBatch);
router.post("/validate", protect, adminOnly, validateScheduleAssignment);
router.post("/validate-batch", protect, adminOnly, validateScheduleAssignmentBatch);
router.post("/available-caregivers-batch", protect, adminOnly, getAvailableCaregiversBatch);
router.get("/available-caregivers", protect, adminOnly, getAvailableCaregivers);
router.get("/by-date", protect, adminOnly, getSchedulesByDate);
router.get("/me", protect, getMySchedules);
router.get("/caregiver/:employeeCode", protect, adminOnly, getSchedulesForCaregiver);
router.put("/update/:scheduleId", protect, adminOnly, updateSchedule);
router.put("/:scheduleId/reassign", protect, adminOnly, reassignSchedule);
router.post("/:scheduleId/cancel", protect, adminOnly, cancelSchedule);

module.exports = router;
