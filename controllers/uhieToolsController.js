/**
 * Foundry tool handlers — same data as core APIs, but 200 + empty results
 * instead of 404 so OpenAPI tools do not fail on "no schedules".
 */
const schedule = require("../models/Schedule");
const caregiver = require("../models/Caregiver");
const LeaveRequest = require("../models/LeaveRequests");
const { getStartOfDay, getEndOfDay } = require("../utils/irelandTime");
const {
  createLeaveRequest,
} = require("./leaveRequestController");

const getSchedulesForCaregiverTool = async (req, res) => {
  try {
    const { employeeCode } = req.params;
    const { date } = req.query;

    const caregiverDoc = await caregiver.findOne({ employeeCode });
    if (!caregiverDoc) {
      return res.status(404).json({
        success: false,
        message: `Caregiver ${employeeCode} not found.`,
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

    return res.status(200).json({
      success: true,
      caregiverEmployeeCode: caregiverDoc.employeeCode,
      caregiverName: caregiverDoc.fullName,
      count: schedules.length,
      data: schedules,
      message:
        schedules.length === 0
          ? `No schedules found for caregiver ${employeeCode}${date ? ` on ${date}` : ""}.`
          : undefined,
    });
  } catch (error) {
    console.error("Error fetching schedules (Foundry tool):", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while fetching schedules for the caregiver.",
    });
  }
};

const getLeaveRequestsByEmployeeTool = async (req, res) => {
  try {
    const { employeeCode } = req.params;

    const caregiverDoc = await caregiver.findOne({ employeeCode });
    if (!caregiverDoc) {
      return res.status(404).json({
        success: false,
        message: `Caregiver ${employeeCode} not found.`,
      });
    }

    const leaveRequests = await LeaveRequest.find({ employeeCode }).sort({
      startDate: 1,
    });

    return res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
      message:
        leaveRequests.length === 0
          ? `No leave requests found for caregiver ${employeeCode}.`
          : undefined,
    });
  } catch (error) {
    console.error("Error fetching leave requests (Foundry tool):", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getSchedulesForCaregiverTool,
  getLeaveRequestsByEmployeeTool,
  createLeaveRequest,
};
