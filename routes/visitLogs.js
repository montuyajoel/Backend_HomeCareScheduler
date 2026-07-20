//server/routes/visitLogs.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getTodayShifts, clockIn, clockOut,  } = require("../controllers/visitLogController");

router.get("/today-shifts", protect, getTodayShifts);
router.post("/clock-in", protect, clockIn);
router.put("/clock-out", protect, clockOut);


module.exports = router;