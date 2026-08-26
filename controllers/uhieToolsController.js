/**
 * Foundry tool handlers - always HTTP 200 so OpenAPI tools do not surface
 * raw status codes in chat. Use `success` and `message` in the JSON body.
 *
 * Caregiver tools: /api/uhie/tools/caregiver/*
 * Admin tools:      /api/uhie/tools/admin/*
 */
const schedule = require("../models/Schedule");
const caregiver = require("../models/Caregiver");
const LeaveRequest = require("../models/LeaveRequests");
const { getStartOfDay, getEndOfDay } = require("../utils/irelandTime");
const { sendToolResult, invokeController } = require("../utils/foundryToolHelpers");
const {
  createLeaveRequest,
  getLeaveRequests,
} = require("./leaveRequestController");
const {
  getAvailableCaregivers,
  validateScheduleAssignment,
  reassignSchedule,
} = require("./scheduleController");
const { assignScheduleToCaregiver } = require("./assignScheduleToCaregiverController");

// Caregiver tools

const getSchedulesForCaregiverTool = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode || req.user?.employeeCode;
    const { date } = req.query;

    const caregiverDoc = await caregiver.findOne({ employeeCode });
    if (!caregiverDoc) {
      return sendToolResult(res, {
        success: false,
        message: `Caregiver ${employeeCode} not found.`,
        count: 0,
        data: [],
      });
    }

    const query = { caregiver: caregiverDoc._id };
    if (date) {
      query.date = { $gte: getStartOfDay(date), $lte: getEndOfDay(date) };
    }

    const schedules = await schedule
      .find(query)
      .populate("client", "fullName clientCode")
      .sort({ date: 1, startTime: 1 });

    if (schedules.length === 0) {
      const dateHint = date ? ` on ${date}` : "";
      return sendToolResult(res, {
        success: true,
        caregiverEmployeeCode: caregiverDoc.employeeCode,
        caregiverName: caregiverDoc.fullName,
        count: 0,
        data: [],
        message: `No shifts found for caregiver ${employeeCode}${dateHint}.`,
      });
    }

    return sendToolResult(res, {
      success: true,
      caregiverEmployeeCode: caregiverDoc.employeeCode,
      caregiverName: caregiverDoc.fullName,
      count: schedules.length,
      data: schedules,
      message: `Found ${schedules.length} shift(s) for caregiver ${employeeCode}${date ? ` on ${date}` : ""}.`,
    });
  } catch (error) {
    console.error("Error fetching schedules (Foundry tool):", error);
    return sendToolResult(res, {
      success: false,
      message: "Unable to retrieve schedules right now.",
      count: 0,
      data: [],
    });
  }
};

const getLeaveRequestsByEmployeeTool = async (req, res) => {
  try {
    const employeeCode = req.params.employeeCode || req.user?.employeeCode;

    const leaveRequests = await LeaveRequest.find({ employeeCode }).sort({
      startDate: 1,
    });

    if (leaveRequests.length === 0) {
      return sendToolResult(res, {
        success: true,
        employeeCode,
        count: 0,
        data: [],
        message: `No leave requests found for caregiver ${employeeCode}.`,
      });
    }

    return sendToolResult(res, {
      success: true,
      employeeCode,
      count: leaveRequests.length,
      data: leaveRequests,
      message: `Found ${leaveRequests.length} leave request(s) for caregiver ${employeeCode}.`,
    });
  } catch (error) {
    console.error("Error fetching leave requests (Foundry tool):", error);
    return sendToolResult(res, {
      success: false,
      message: "Unable to retrieve leave requests right now.",
      count: 0,
      data: [],
    });
  }
};

const createLeaveRequestTool = async (req, res) => {
  const acting = req.user?.employeeCode;
  if (req.body?.employeeCode && acting && req.body.employeeCode !== acting) {
    return sendToolResult(res, {
      success: false,
      message: "Caregivers may only file leave for their own employeeCode.",
    });
  }
  if (acting && !req.body?.employeeCode) {
    req.body = { ...req.body, employeeCode: acting };
  }
  return invokeController(createLeaveRequest, req, res);
};

// Admin tools

const findAvailableCaregiversTool = (req, res) =>
  invokeController(getAvailableCaregivers, req, res);

const validateScheduleAssignmentTool = (req, res) =>
  invokeController(validateScheduleAssignment, req, res);

const assignScheduleTool = (req, res) =>
  invokeController(assignScheduleToCaregiver, req, res);

const reassignScheduleTool = (req, res) =>
  invokeController(reassignSchedule, req, res);

const getPendingLeaveRequestsTool = (req, res) => {
  req.query = { ...req.query, status: "pending" };
  return invokeController(getLeaveRequests, req, res);
};

module.exports = {
  getSchedulesForCaregiverTool,
  getLeaveRequestsByEmployeeTool,
  createLeaveRequestTool,
  findAvailableCaregiversTool,
  validateScheduleAssignmentTool,
  assignScheduleTool,
  reassignScheduleTool,
  getPendingLeaveRequestsTool,
};
