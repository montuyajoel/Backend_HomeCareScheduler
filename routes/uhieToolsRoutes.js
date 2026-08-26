/**
 * Foundry OpenAPI tool surface — x-api-key only.
 * Caregiver and admin tools are isolated by path + actingRole checks.
 */
const express = require("express");
const router = express.Router();
const { foundryToolAuth } = require("../middleware/foundryToolAuth");
const { requireAdminTool, requireCaregiverTool } = require("../middleware/foundryToolRole");
const {
  getSchedulesForCaregiverTool,
  getLeaveRequestsByEmployeeTool,
  createLeaveRequestTool,
  findAvailableCaregiversTool,
  validateScheduleAssignmentTool,
  assignScheduleTool,
  reassignScheduleTool,
  getPendingLeaveRequestsTool,
} = require("../controllers/uhieToolsController");

const TOOLS_VERSION = "3.0.0";

// Public — verify deployment (no x-api-key)
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "uhie-foundry-tools",
    version: TOOLS_VERSION,
    adminToolsEnabled: true,
    caregiverToolsEnabled: true,
    operations: {
      caregiver: [
        "getCaregiverSchedules",
        "getCaregiverLeaveRequests",
        "createCaregiverLeaveRequest",
      ],
      admin: [
        "findAvailableCaregivers",
        "validateScheduleAssignment",
        "assignSchedule",
        "reassignSchedule",
        "getPendingLeaveRequests",
      ],
    },
  });
});

router.use(foundryToolAuth);

// Caregiver tools (actingRole=caregiver)

router.get(
  "/caregiver/schedules/:employeeCode",
  requireCaregiverTool,
  getSchedulesForCaregiverTool
);

router.get(
  "/caregiver/leave-requests/:employeeCode",
  requireCaregiverTool,
  getLeaveRequestsByEmployeeTool
);

router.post("/caregiver/leave-requests", requireCaregiverTool, createLeaveRequestTool);

// Legacy caregiver paths (backward compatible)
router.get("/schedules/:employeeCode", requireCaregiverTool, getSchedulesForCaregiverTool);
router.get("/leave-requests/:employeeCode", requireCaregiverTool, getLeaveRequestsByEmployeeTool);
router.post("/leave-requests", requireCaregiverTool, createLeaveRequestTool);

// Admin tools (actingRole=admin)

router.get(
  "/admin/schedules/available-caregivers",
  requireAdminTool,
  findAvailableCaregiversTool
);

router.post("/admin/schedules/validate", requireAdminTool, validateScheduleAssignmentTool);
router.post("/admin/schedules/assign", requireAdminTool, assignScheduleTool);
router.put("/admin/schedules/:scheduleId/reassign", requireAdminTool, reassignScheduleTool);
router.get("/admin/leave-requests/pending", requireAdminTool, getPendingLeaveRequestsTool);

module.exports = router;
