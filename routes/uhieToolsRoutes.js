/**
 * Foundry OpenAPI tool surface — x-api-key only.
 * Does not use JWT `protect`; existing Bearer endpoints are untouched.
 */
const express = require("express");
const router = express.Router();
const { foundryToolAuth } = require("../middleware/foundryToolAuth");
const { getSchedulesForCaregiver } = require("../controllers/scheduleController");
const {
  createLeaveRequest,
  getLeaveRequestById,
} = require("../controllers/leaveRequestController");

router.use(foundryToolAuth);

// GET /api/uhie/tools/schedules/:employeeCode?date=YYYY-MM-DD
router.get("/schedules/:employeeCode", getSchedulesForCaregiver);

// GET /api/uhie/tools/leave-requests/:employeeCode
router.get("/leave-requests/:employeeCode", (req, res, next) => {
  req.params.employeeId = req.params.employeeCode;
  return getLeaveRequestById(req, res, next);
});

// POST /api/uhie/tools/leave-requests
// Body: { employeeCode, leaveType, startDate, endDate, reason? }
router.post("/leave-requests", createLeaveRequest);

module.exports = router;
