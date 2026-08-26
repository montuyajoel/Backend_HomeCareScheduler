/**
 * Foundry OpenAPI tool surface — x-api-key only.
 * Does not use JWT `protect`; existing Bearer endpoints are untouched.
 */
const express = require("express");
const router = express.Router();
const { foundryToolAuth } = require("../middleware/foundryToolAuth");
const {
  getSchedulesForCaregiverTool,
  getLeaveRequestsByEmployeeTool,
  createLeaveRequestTool,
} = require("../controllers/uhieToolsController");

router.use(foundryToolAuth);

// GET /api/uhie/tools/schedules/:employeeCode?date=YYYY-MM-DD
router.get("/schedules/:employeeCode", getSchedulesForCaregiverTool);

// GET /api/uhie/tools/leave-requests/:employeeCode
router.get("/leave-requests/:employeeCode", getLeaveRequestsByEmployeeTool);

// POST /api/uhie/tools/leave-requests
// Body: { employeeCode, leaveType, startDate, endDate, reason? }
router.post("/leave-requests", createLeaveRequestTool);

module.exports = router;
