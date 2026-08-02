const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

const { assignScheduleToCaregiver, getMySchedules, getSchedulesForCaregiver, updateSchedule } = require("../controllers/scheduleController");

// Route to assign a schedule to a caregiver
router.post("/assign", protect, adminOnly, assignScheduleToCaregiver);
router.get("/me", protect, getMySchedules);
router.get("/caregiver/:caregiverId", protect, adminOnly, getSchedulesForCaregiver);
router.put("/update/:scheduleId", protect, adminOnly, updateSchedule);


module.exports = router;