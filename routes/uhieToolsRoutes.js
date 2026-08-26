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

router.use(foundryToolAuth);

// ??? Caregiver tools (actingRole=caregiver) ????????????????????????????????

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

// ??? Admin tools (actingRole=admin) ????????????????????????????????????????

// 1. Find suitable caregivers for a client shift
router.get(
  "/admin/schedules/available-caregivers",
  requireAdminTool,
  findAvailableCaregiversTool
);

// Optional validate before assign
router.post("/admin/schedules/validate", requireAdminTool, validateScheduleAssignmentTool);

// Proceed to add schedule after admin confirms caregiver + slot
router.post("/admin/schedules/assign", requireAdminTool, assignScheduleTool);

// 2. Reassign an existing shift
router.put("/admin/schedules/:scheduleId/reassign", requireAdminTool, reassignScheduleTool);

// 3. Pending leave requests
router.get("/admin/leave-requests/pending", requireAdminTool, getPendingLeaveRequestsTool);

module.exports = router;
