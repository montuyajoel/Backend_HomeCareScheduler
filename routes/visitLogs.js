//server/routes/visitLogs.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getTodayShifts, clockIn, clockOut, getUpcoming14DayShifts } = require("../controllers/visitLogController");

router.get("/today-shifts", protect, getTodayShifts);
router.get("/future-shifts", protect, getUpcoming14DayShifts);
router.post("/clock-in", protect, clockIn);
router.put("/clock-out", protect, clockOut);


module.exports = router;