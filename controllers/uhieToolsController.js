/**
 * Foundry tool handlers — always HTTP 200 so OpenAPI tools do not surface
 * raw status codes in chat. Use `success` and `message` in the JSON body.
 */
const schedule = require("../models/Schedule");
const caregiver = require("../models/Caregiver");
const LeaveRequest = require("../models/LeaveRequests");
const { getStartOfDay, getEndOfDay } = require("../utils/irelandTime");
const {
  createLeaveRequest,
} = require("./leaveRequestController");

const sendToolResult = (res, payload) => res.status(200).json(payload);

const getSchedulesForCaregiverTool = async (req, res) => {
  try {
    const { employeeCode } = req.params;
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
    const { employeeCode } = req.params;

    const caregiverDoc = await caregiver.findOne({ employeeCode });
    if (!caregiverDoc) {
      return sendToolResult(res, {
        success: false,
        message: `Caregiver ${employeeCode} not found.`,
        count: 0,
        data: [],
      });
    }

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
  let body = { success: false, message: "Unable to create leave request." };

  const proxy = {
    status() {
      return proxy;
    },
    json(payload) {
      body = payload;
      return proxy;
    },
  };

  try {
    await createLeaveRequest(req, proxy);
    return sendToolResult(res, body);
  } catch (error) {
    console.error("Error creating leave request (Foundry tool):", error);
    return sendToolResult(res, {
      success: false,
      message: "Unable to create leave request right now.",
    });
  }
};

module.exports = {
  getSchedulesForCaregiverTool,
  getLeaveRequestsByEmployeeTool,
  createLeaveRequestTool,
};
