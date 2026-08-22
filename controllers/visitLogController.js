/*complete business logic for 4 functions :
getTodayShifts,clockIn, clockOut, getUpcoming2WeeksShifts
getUpcoming2WeeksShifts is separated in the controllers/getUpcoming2WeeksShifts.js */
const VisitLog = require("../models/VisitLog");
const Schedule = require("../models/Schedule");
//add this to resolve the caregiver profile from the logged-in user
const Caregiver = require("../models/Caregiver");
//const Client = require("../models/Client");
const User = require("../models/User");
const Client = require("../models/Client");
const { getUpcoming2WeeksShifts } = require("../controllers/getUpcoming2WeeksShifts")

const { getDistanceInMeters } = require("../utils/geoUtils");

//-----------------all unifies to a 20 mins windows------------------------
//Clock In button becomes enables 20 mins before shift starts
const CLOCK_IN_BUTTON_LEAD_MINUTES = 20;

//"On-time" window, clock in/out successfully without note: + or - 20mins around shift starts
const ON_TIME_WINDOW_MINUTES = 20;

//Beyond 200meters, fails immediately, no note bypass (hard location rule)
const LOCATION_RADIUS_METERS = 500;

//-------------------Get today's shifts for this caregiver(including button state, earliest allowed message)--------------------------
//each document in the Schedule collection is a shift.
// "all of today's shifts combined " means a caregiver's full schedule for today

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

function pickBestVisitLog(logs) {
    if (!logs || logs.length === 0) return null;
    if (logs.length === 1) return logs[0];

    const completed = logs.find((log) => log.status === "completed" || log.clockOut?.time);
    if (completed) return completed;

    return logs.reduce((latest, log) => {
        const latestTime = latest.updatedAt ? new Date(latest.updatedAt) : new Date(0);
        const logTime = log.updatedAt ? new Date(log.updatedAt) : new Date(0);
        return logTime > latestTime ? log : latest;
    });
}

function buildVisitLogByScheduleId(visitLogs) {
    const grouped = new Map();
    for (const log of visitLogs) {
        const key = log.schedule.toString();
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(log);
    }

    const result = new Map();
    for (const [key, logs] of grouped) {
        result.set(key, pickBestVisitLog(logs));
    }
    return result;
}

function getShiftStartDate(shift) {
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const shiftStart = new Date(shift.date);
    shiftStart.setHours(startHour, startMinute, 0, 0);
    return shiftStart;
}

//helper function to get the shift end date-time as a Date object
function getShiftEndDate(shift) {
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);
    const shiftEnd = new Date(shift.date);
    shiftEnd.setHours(endHour, endMinute, 0, 0);
    return shiftEnd;
}

const getTodayShifts = async (req, res) => {
    try {
            //const userId = req.user._id; //current login user Id, not the caregiver ID
            const userId = req.user.id;
            const caregiver = await getCaregiverByUserId(userId);

            console.log('-------getTodayShifts-------', caregiver ,'=====', userId)
            if (!caregiver) {
                return res.status(404).json({
                    success: false, message: "Caregiver profile not found for this account",
                    code: "CAREGIVER_NOT_FOUND",
                })
            }

            const caregiverId = caregiver._id; //the actual Caregiver ID for querying Schedule

            const startOfDay =new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            //sorted ascending by start time, earliest shift appears first
            const shifts = await Schedule.find({
                caregiver: caregiverId,
                date: { $gte: startOfDay, $lte: endOfDay },
            })
                .populate("client", "fullName clientCode address notes carePlan") //never populate phone field-privacy rule
                .sort({ startTime: 1 });
            //.populate("client", "fullName clientCode address") targets only that one field,
            // it looks up the Client collection using that ID
            // and replaces the reference with the actual client data
            //(limited to fullName, clientCode, address).
            //It does not touch startTime, endTime, caregiver, or date — those stay exactly as they were on the Schedule document.

            //console.log("shiftId ====== ");
            const ShiftIds = shifts.map((s) => s._id);
            const visitLogs = await VisitLog.find({ schedule: { $in: ShiftIds } });
            const visitLogByScheduleId = buildVisitLogByScheduleId(visitLogs);
            const now = new Date();

            const result = await Promise.all(shifts.map(async (shift) => {
                const log = visitLogByScheduleId.get(shift._id.toString());

                /*const [startHour, startMinute] = shift.startTime.split(":").map(Number);
                const shiftStart = new Date(shift.date);
                shiftStart.setHours(startHour, startMinute, 0, 0);

                const [endHour, endMinute] = shift.endTime.split(":").map(Number);
                const shiftEnd = new Date(shift.date);
                shiftEnd.setHours(endHour, endMinute, 0, 0);*/

                const shiftStart = getShiftStartDate(shift);
                //shiftStart.setHours(startHour, startMinute, 0, 0);

                const earliestEnabledTime = new Date(shiftStart);
                earliestEnabledTime.setMinutes(earliestEnabledTime.getMinutes() - CLOCK_IN_BUTTON_LEAD_MINUTES);

                const isClockInTimeEnabled = now >= earliestEnabledTime;

                const clientDetails = await Client.findById(shift.client._id);
                
                return {
                    scheduleId: shift._id,
                    client: clientDetails,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    hasClockedIn: !!log?.clockIn?.time,
                    hasClockedOut: !!log?.clockOut?.time,
                    status: log?.status || null, //"in-progress" or "completed" or null
                    visitLogId: log?._id || null,
                    isClockInTimeEnabled, //frontend uses this directly for the disabled-button hint text, so don't need to recalculate
                    earliestEnabledTimeFormatted: earliestEnabledTime.toLocaleString("en-GB"),
                };
            }))
            //.filter((shift) => !shift.hasClockedOut);//remove the completed(clocked-out) shifts from the list
            
            //distinguish "no shifts today" from "all shifts already completed"
            if (result.length === 0) {
                return res.status(200).json({
                    success: true, body: [], message: shifts.length === 0 ? "NO shifts today." : "All shifts completed for today.",
                });
            }

            res.status(200).json({ success: true, body: result });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
};




//-------------------Clock In----------------
const clockIn = async (req, res) => {
    try {
        console.log("==========Clock In ==================");
        console.log("request------>>", req);
        console.log("req.userId------------>>", req.user.id);
        const {  scheduleId, clientId, latitude, longitude, note } = req.body;
        const userId = req.user.id;//currently logged-in account's user ID

        console.log("req.user = ", req.user);
        console.log("req.user?.id =", req.user?.id);
        console.log("req.user.id =", userId.toString);

        console.log("userId =", userId);
        console.log("typeof userId =", typeof userId);
    
        const caregiver = await getCaregiverByUserId(userId);
        console.log("caregiver found =", caregiver ? caregiver._id.toString() : null);
        console.log("caregiver = ------>", caregiver)
        if (!caregiver) {
            return res.status(404).json({
                success: false, message: "Caregiver profile not found for this account",
                code: "CAREGIVER_NOT_FOUND",
            })
        }

        const caregiverId = caregiver._id; //the actual caregiver Id used when writing the VisitLog
        const shift = await Schedule.findById(scheduleId).populate("client");

        console.log("scheduleId from body = ", scheduleId);
        console.log("shift found = ", shift ? shift._id.toString() : null);
        console.log("shift.caregiver = ", shift ? shift.caregiver.toString() : null);
        console.log("caregiverId = ", caregiverId.toString());

        if (!shift) {
            return res.status(404).json({
                success: false, message: "shift not found。 Please select a valid shift.",
            })
        }

        //---------1. Confirm this shift is actually assigned to the caregiver,
        // prevents caregiver using other's scheduleID----------------
        if (shift.caregiver.toString() !== caregiverId.toString()) {
            return res.status(403).json({
                success: false, message: "This shift is not assigned to you.",
                code: "NOT_YOUR_SHIFT",
            });
        }

        //-----------2.shift matching check------------------
        //the selected client must match the shift's client
        if (shift.client._id.toString() !== clientId) {
            return res.status(400).json({
                success: false,
                message: "Current shift does not match the selected shift. Please choose the correct shift.",
                code: "SHIFT_MISMATCH",
            });
        }

        //the shift date must be today
        const today = new Date();
        const shiftDate = new Date(shift.date);
        const isSameDay = today.getFullYear() === shiftDate.getFullYear() &&
            today.getMonth() === shiftDate.getMonth() &&
            today.getDate() === shiftDate.getDate();
        
        if (!isSameDay) {
            return res.status(400).json({
                success: false, message: "This shift is not scheduled for today.",
                code: "SHIFT_MISMATCH",
            });
        }

        // this shift only can be clocked in once.
        //If a VisitLog already exists with status "in- progress", block the duplicate attempt
        const existingVisit = await VisitLog.findOne({ schedule: shift._id });

        console.log("existingVisit found =", existingVisit ? existingVisit._id.toString() : null);
        console.log("existingVisit.status =", existingVisit ? existingVisit.status : null);

        if (existingVisit && existingVisit.status === "in-progress") {
            return res.status(400).json({
                success: false,
                message: "This shift is currently in progress. Please go to Clock Out.",
                code: "ALREADY_IN_PROGRESS",
            });
        }
        if (existingVisit && existingVisit.status === "completed") {
            return res.status(400).json({
                success: false,
                message: "This shift has been completed.",
                code: "ALREADY_COMPLETED",
            });
        }

        /*const newVisit = new VisitLog({
            caregiver: req.user._id,  //from protect middleware JWT
            client: clientId,
            clockIn: {
                time: new Date(),
                location: { latitude, longitude },
            },
        });*/

        const now = new Date();
        const shiftStart = getShiftStartDate(shift);
        //shiftStart.setHours(startHour, startMinute, 0, 0);
        /*const [startHour, startMinute] = shift.startTime.split(":").map(Number);
        const shiftStart = new Date(shiftDate);
        shiftStart.setHours(startHour, startMinute, 0, 0);*/

        //---------3. early clock-in restriction ,hard button- disable check, at most early 20mins-----------------
        const earliestEnabledTime = new Date(shiftStart);
        earliestEnabledTime.setMinutes( earliestEnabledTime.getMinutes() - CLOCK_IN_BUTTON_LEAD_MINUTES);

        //backend double check, against bypassing the fronted and calling the API directly
        //(fronted button is already disabled)
        if (now < earliestEnabledTime) {
            return res.status(400).json({
                success: false,
                message: `You are not able to clock in before ${formatDateTime(earliestEnabledTime)}`,
                code: "TOO_EARLY",
            });
        }

        //------------4.Location check (hard rule, 200m radius, no note bypass)----------------------------
        const clientLat = shift.client.address?.latitude;
        const clientLon = shift.client.address?.longitude;

        //If a data issue happens, client address coordinates missing, it's not the caregiver's fault
        if (clientLat == null || clientLon == null) {  //"null" and "undefined"
            return res.status(400).json({
                success: false, message: "Client address coordinates are missing. Please contact admin in office.",
                code: "ADDRESS_MISSING",
            });
        }
        const distance = getDistanceInMeters(latitude, longitude, clientLat, clientLon);

        console.log(`Clock In Location Check:
            Caregiver at (${latitude}, ${longitude}),
            Client at (${clientLat}, ${clientLon}),
            Distance = ${distance.toFixed(2)} meters`);

        //If distance > LOCATION_RADIUS_METERS， then it's a hard clock-out failure.
        //No note can bypass this
        if (distance > LOCATION_RADIUS_METERS) {
            return res.status(400).json({
                success: false, message: "Your location is too far from the target. Please check your location.",
                code: "LOCATION_TOO_FAR",
            });
        }

        //---- time deviation check (only reached if location already passed) ----
        const minutesFromStart = (now - shiftStart) / 1000 / 60;
        // negative = early, positive = late
        const isWithinOnTimeWindow = Math.abs(minutesFromStart) <= ON_TIME_WINDOW_MINUTES;
        const isLate = minutesFromStart > ON_TIME_WINDOW_MINUTES;
        // If outside the on-time window, classified as "late", and no note provided -> require note
        if (!isWithinOnTimeWindow && isLate && (!note || note.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: `You are clocking in more than ${ON_TIME_WINDOW_MINUTES} minutes after the shift start time. Please provide a note to continue.`,
                code: "NOTE_REQUIRED",
                exceptionType: ["late-clock-in"],
            });
        }
    //-----------6 Create VisitLog --------------
        const flaggedLate = !isWithinOnTimeWindow && isLate;

        const newVisit = new VisitLog({
            schedule: shift._id,
            caregiver: caregiverId, client: clientId,
            clockIn: { time: now, location: { latitude, longitude }, },
            clockOut: { time: null, location:{ latitude:null, longitude: null } },
            status: "in-progress", isException: flaggedLate,
            exceptionType: flaggedLate ? ["late-clock-in"] : [],//？？？？？？？？？
            note: flaggedLate ? note : undefined,
            reviewRequired: flaggedLate,
            reviewStatus: flaggedLate ? "pending-review" : "not-required",
        });

        const saved = await newVisit.save();
        console.log('newVisitDetail------------------------>>', newVisit)
        console.log('newVisit created successfully--------------------', saved)
        res.status(201).json({ success: true, data: saved });

    } catch (error) {
        console.error("CLOCKIN ERROR:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

//==========================Clock Out=========================================

const clockOut = async (req, res) => {
    try {
        console.log("==========Clock Out ==================");
        console.log('clockout-------->>',req.body)
        //const { visitId, latitude, longitude } = req.body;
        console.log("req.userId = ", req.user.id);
        const {  visitId, clientId, latitude, longitude, note } = req.body;
        const userId = req.user.id;//currently logged-in account's user ID
        const caregiver = await getCaregiverByUserId(userId);

        //-----------------1 Confirm caregiver profile----------------
        console.log('------caregiver info--------', caregiver)
        if (!caregiver) {
            return res.status(404).json({
                success: false, message: "Caregiver profile not found for this account.",
                code: "CAREGIVER_NOT_FOUND",
            });
        }

        const caregiverId = caregiver._id;
        console.log('-----------caregiverId-----------', caregiverId)

        const visit = await VisitLog.findById(visitId).populate({ path: "schedule", populate: { path: "client" }, })
        console.log('------------visitId-----------', visitId)
        console.log('------------visitLog-----------', visit)
        if (!visit) {
            return res.status(404).json({ success: false, message: "Visit not found." });
        }

        //-------2.Confirm this VisitLog actually belongs to the currently logged-in caregiver ----
        //Prevents caregiver A from clocking out using someone else's visitId
        if (visit.caregiver.toString() !== caregiverId.toString()) {
            return res.status(403).json({
                success: false, message: "This visit does not belong to you.", code: "NOT_YOUR_VISIT",
            });
        }

        if (visit.status === "completed") {
            return res.status(400).json({
                success: false, message: "This visit has already been clocked out.", code: "ALREADY_COMPLETED",
            });
        }

        const shift = visit.schedule;
        const now = new Date();
        
        //------------3.Location check (hard rule, 200m radius, no note bypass)--------------
        // Clock-out follows the same hard 200m location rule
        const clientLat = shift.client.address?.latitude;
        const clientLon = shift.client.address?.longitude;

        if (clientLat == null || clientLon == null) {
            return res.status(400).json({
                success: false, message: "Client address coordinates are missing. Please contact admin.", code: "ADDRESS_MISSING",
            });
        }

        const distance = getDistanceInMeters(latitude, longitude, clientLat, clientLon);
        console.log(`Clock Out Location Check:
            Caregiver at (${latitude}, ${longitude}),
            Client at (${clientLat}, ${clientLon}),
            Distance = ${distance.toFixed(2)} meters`);

        //If distance > LOCATION_RADIUS_METERS， then it's a hard clock-out failure.
        //No note can bypass this.  The caregiver must be within 200m of the client to clock out.
        if (distance > LOCATION_RADIUS_METERS) {
            return res.status(400).json({
                success: false, message: "Your location is too far from the target. Please check your location.", 
                code: "LOCATION_TOO_FAR",
            });
        }
        //-------------4. time deviation check (only reached if location already passed) ----
        //In real world, the caregiver may be rejected by the client and leave early,
        //so we don't enforce a hard rule for clock-out time. NO earliestEnabled-ClockOut-Time
        //If the clock-out time is more or less than the shift end time 20mins(ON_TIME_WINDOW_MINUTES),
        //it's still accepted，but the note needs to be provided.
        //The duration will be calculated based on the actual clock-out time and clock-in time.

        const shiftEnd = getShiftEndDate(shift);

        const durationMs = now - visit.clockIn.time;
        const durationMinutes = Math.round(durationMs / 1000 / 60);

        visit.clockOut = { time: now, location: { latitude:latitude, longitude:longitude }};
        visit.durationMinutes = durationMinutes;

        const minutesFromEnd = (now - shiftEnd) / 1000 / 60;
        // negative = early, positive = late
        const isWithinOnTimeWindow = Math.abs(minutesFromEnd) <= ON_TIME_WINDOW_MINUTES;
        const isLate = minutesFromEnd > ON_TIME_WINDOW_MINUTES;
        const isEarly = minutesFromEnd < -ON_TIME_WINDOW_MINUTES;

        console.log(`Clock Out Time Check: now=${formatDateTime(now)},
            shiftEnd=${formatDateTime(shiftEnd)},
            minutesFromEnd=${minutesFromEnd},
            isWithinOnTimeWindow=${isWithinOnTimeWindow},
            isLate=${isLate},
            isEarly=${isEarly}`);
        
        // If outside after the on-time window, classified as "late", and no note provided -> require note
        if (!isWithinOnTimeWindow && isLate && (!note || note.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: `You are clocking out more than ${ON_TIME_WINDOW_MINUTES} minutes after the shift end time. Please provide a note to continue.`,
                code: "NOTE_REQUIRED",
                exceptionType: ["late-clock-out"],
            });
        }
        // If outside before the on-time window, classified as "early", and no note provided -> require note
        if (!isWithinOnTimeWindow && isEarly && (!note || note.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: `You are clocking out more than ${ON_TIME_WINDOW_MINUTES} minutes before the shift end time. Please provide a note to continue.`,
                code: "NOTE_REQUIRED",
                exceptionType: ["early-clock-out"],
            });
        }
        //-----------6 Update VisitLog and Schedule --------------
        const flaggedLate = !isWithinOnTimeWindow && (isLate || isEarly);

        visit.status = "completed";

        if (flaggedLate) {
            visit.isException = true;
            const clockOutException = isLate ? "late-clock-out" : "early-clock-out";
            if (!visit.exceptionType.includes(clockOutException)) {
                visit.exceptionType.push(clockOutException);
            }
            if (note) {
                visit.note = visit.note ? `${visit.note}; ${note}` : note;
            }
            visit.reviewRequired = true;
            visit.reviewStatus = "pending-review";
        }

        shift.status = "completed";
        await shift.save();

        const updated = await visit.save();
        res.status(200).json({ success: true, data: updated });

    } catch (error) {
        console.error("CLOCKOUT ERROR:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Classify a shift as current / upcoming / done using visit log + time window
function getSchedulePhase(shift, visitLog, now) {
    if (shift.status === "cancelled") return "cancelled";
    if (visitLog?.status === "completed" || visitLog?.clockOut?.time || shift.status === "completed") {
        return "done";
    }
    if (visitLog?.status === "in-progress" || visitLog?.clockIn?.time || shift.status === "in-progress") {
        return "current";
    }

    const shiftStart = getShiftStartDate(shift);
    const shiftEnd = getShiftEndDate(shift);

    if (now >= shiftStart && now <= shiftEnd) return "current";
    if (now > shiftEnd) return "done";
    return "upcoming";
}

// Admin: caregivers on duty today, with schedule counts and current/upcoming/done lists
const getAllCaregiversWithShiftToday = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const now = new Date();

        const shiftsToday = await Schedule.find({
            date: { $gte: today, $lt: tomorrow },
            status: { $ne: "cancelled" },
        })
            .populate("caregiver", "employeeCode fullName phoneNumber status")
            .populate("client", "fullName clientCode address")
            .sort({ startTime: 1 });

        if (shiftsToday.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No caregivers with shifts today.",
            });
        }

        const shiftIds = shiftsToday.map((s) => s._id);
        const visitLogs = await VisitLog.find({ schedule: { $in: shiftIds } });
        const visitLogByScheduleId = buildVisitLogByScheduleId(visitLogs);

        const byCaregiver = new Map();

        for (const shift of shiftsToday) {
            if (!shift.caregiver) continue;

            const caregiverId = shift.caregiver._id.toString();
            if (!byCaregiver.has(caregiverId)) {
                byCaregiver.set(caregiverId, {
                    caregiver: shift.caregiver,
                    scheduleCount: 0,
                    counts: { current: 0, upcoming: 0, done: 0 },
                    schedules: { current: [], upcoming: [], done: [] },
                    onDuty: false,
                });
            }

            const entry = byCaregiver.get(caregiverId);
            const visitLog = visitLogByScheduleId.get(shift._id.toString());
            const phase = getSchedulePhase(shift, visitLog, now);

            if (phase === "cancelled") continue;

            const scheduleSummary = {
                scheduleId: shift._id,
                client: shift.client,
                startTime: shift.startTime,
                endTime: shift.endTime,
                scheduleStatus: shift.status,
                visitStatus: visitLog?.status || null,
                hasClockedIn: !!visitLog?.clockIn?.time,
                hasClockedOut: !!visitLog?.clockOut?.time,
                phase,
            };

            entry.scheduleCount += 1;
            entry.counts[phase] += 1;
            entry.schedules[phase].push(scheduleSummary);
            if (phase === "current") entry.onDuty = true;
        }

        const data = Array.from(byCaregiver.values()).sort((a, b) => {
            if (a.onDuty !== b.onDuty) return a.onDuty ? -1 : 1;
            return (a.caregiver.fullName || "").localeCompare(b.caregiver.fullName || "");
        });

        res.status(200).json({
            success: true,
            data,
            summary: {
                caregiverCount: data.length,
                onDutyCount: data.filter((c) => c.onDuty).length,
                totalSchedules: shiftsToday.length,
            },
        });
    } catch (error) {
        console.error("ERROR fetching caregivers with shifts today:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Format date-time as day/month/year hour:min:second
function formatDateTime(date) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const time = date.toTimeString().split(" ")[0]; // HH:MM:SS
    return `${dd}/${mm}/${yyyy} ${time}`;
}
module.exports = { getTodayShifts,clockIn, clockOut, getUpcoming2WeeksShifts, getAllCaregiversWithShiftToday };
