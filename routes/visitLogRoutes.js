//server/routes/visitLogs.js
const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getTodayShifts, clockIn, clockOut, getUpcoming2WeeksShifts, getAllCaregiversWithShiftToday } = require("../controllers/visitLogController");

router.get("/today-shifts", protect, getTodayShifts);
router.post("/clock-in", protect, clockIn);
router.put("/clock-out", protect, clockOut);
router.get("/upcoming-shifts", protect, getUpcoming2WeeksShifts);
router.get("/caregivers-with-shift-today", protect, adminOnly, getAllCaregiversWithShiftToday);

module.exports = router;