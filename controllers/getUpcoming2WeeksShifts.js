const Client = require("../models/Client");
const User = require("../models/User");
const Caregiver = require("../models/Caregiver");
const Schedule = require("../models/Schedule");
const VisitLog = require("../models/VisitLog");

const {
    now,
    getStartOfDay,
    getEndOfDay,
    addDays,
    getShiftStartDate,
    formatDateTime,
} = require("../utils/irelandTime");

const CLOCK_IN_BUTTON_LEAD_MINUTES = 20;

const { ObjectId } = require('mongodb');
const getCaregiverByUserId = async (userId) => {
    //return await Caregiver.findOne({ userId: new ObjectId(userId) });
    const user = await User.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw new Error("User not found");
    }
    return await Caregiver.findOne({
        _id: new ObjectId(user.caregiverId) });
};//helper

// Get all shifts for 14 days (today + 13 days) for the logged-in caregiver
const getUpcoming2WeeksShifts = async (req, res) => {
    try {
        //const userId = req.user._id; //current login user Id, not the caregiver ID
        const userId = req.user.id;
        const caregiver = await getCaregiverByUserId(userId);

        if (!caregiver) {
            return res.status(404).json({
                success: false,
                message: "Caregiver profile not found for this account",
                code: "CAREGIVER_NOT_FOUND",
            });
        }

        const caregiverId = caregiver._id; //the actual Caregiver ID for querying Schedule

        const startDate = getStartOfDay();
        const endDate = getEndOfDay(addDays(startDate, 13));

        //sorted ascending by date and start time
        // Exclude cancelled schedules so admin cancel removes them from caregiver views
        const shifts = await Schedule.find({
            caregiver: caregiverId,
            date: { $gte: startDate, $lte: endDate },
            status: { $ne: "cancelled" },
        })
            .populate("client", "fullName clientCode address notes carePlan") //never populate phone field-privacy rule
            .sort({ date: 1, startTime: 1 });

        //.populate("client", "fullName clientCode address") targets only those fields,
        //it looks up the Client collection using that ID
        //and replaces the reference with the actual client data
        //(limited to fullName, clientCode, address, notes and carePlan).
        //It does not touch startTime, endTime, caregiver, or date — those stay exactly as they were on the Schedule document.

        const ShiftIds = shifts.map((s) => s._id);
        const visitLogs = await VisitLog.find({
            schedule: { $in: ShiftIds },
        });

        const currentTime = now();

        const result = shifts
            .map((shift) => {
                const log = visitLogs.find(
                    (v) => v.schedule.toString() === shift._id.toString()
                );

                const shiftStart = getShiftStartDate(shift);

                const earliestEnabledTime = new Date(shiftStart);
                earliestEnabledTime.setMinutes(
                    earliestEnabledTime.getMinutes() - CLOCK_IN_BUTTON_LEAD_MINUTES
                );

                const isClockInTimeEnabled = currentTime >= earliestEnabledTime;

                return {
                    scheduleId: shift._id,
                    client: shift.client,
                    date: shift.date,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    hasClockedIn: !!log?.clockIn?.time,
                    hasClockedOut: !!log?.clockOut?.time,
                    status: log?.status || null, //"in-progress" or "completed" or null
                    visitLogId: log?._id || null,
                    isClockInTimeEnabled, //frontend uses this directly for the disabled-button hint text, so don't need to recalculate
                    earliestEnabledTimeFormatted: formatDateTime(earliestEnabledTime),
                };
            })
            .filter((shift) => !shift.hasClockedOut); //remove the completed(clocked-out) shifts from the list

        //distinguish "no scheduled shifts" from "all scheduled shifts already completed"
        if (result.length === 0) {
            return res.status(200).json({
                success: true,
                body: [],
                message:
                    shifts.length === 0
                        ? "No shifts scheduled for the next 14 days."
                        : "All shifts completed for the next 14 days.",
            });
        }

        res.status(200).json({
            success: true,
            body: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = { getUpcoming2WeeksShifts };