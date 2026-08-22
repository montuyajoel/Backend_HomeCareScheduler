/*AssignScheduleToCaregiver handles the core function of scheduling, which an admin assigns a
client's needed care period (called a "visit" from the client's side,
a "shift" from the caregiver's side) to a caregiver. Before creating the
record, it must pass all 8 rules in sequence, any failure
stops immediately with a specific reason.*/

const schedule = require("../models/Schedule");
const client = require("../models/Client");
const caregiver = require("../models/Caregiver");
const auditLog = require("../models/AuditLog");
//const user = require("../models/User");

//const { ObjectId } = require('mongodb');

//Minimum commute buffer (in hours) required between two of a caregiver's shifts on the same day.
//Using a fixed valuefor now instead of a real-time transit API;
//If real commute-time calculation is added later, only needs to change the comparison inside checkShiftGap.
const MIN_SHIFT_GAP_HOURS = 0.5;

//-----------------Helper: time string -> minutes since midnight----------------------------
//Converts an "HH:MM" time string into minutes since midnight, so
//times can be compared as plain numbers instead of parsing strings or dealing with full Date objects.
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

//-----------------Helper: which weekday does this date fall on----------------------------
//Convert the requested date to an English weekday name,
//matching the `day` field format in Caregiver.availability.
function getWeekdayName(dateStr) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date(dateStr).getDay()];
}

//-----------Rule 7: is the requested shift within an availability window?--------------
/*Rule 7 — checks if, Among all of this caregiver's availability blocks for the requested weekday, at least one block fully
contains the requested shift. It means that shift start >= block start, shift end <= block end.
A caregiver may have multiple availability blocks on the same day; matching any one of them is sufficient.*/

function isWithinAvailability(caregiverDoc, weekday, startTime, endTime) {
    const shiftStart = timeToMinutes(startTime);
    const shiftEnd = timeToMinutes(endTime);
    return caregiverDoc.availability.some(block => {
        if (block.day !== weekday) return false;

        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);
        return shiftStart >= blockStart && shiftEnd <= blockEnd;
    })
}

//-----------Rule 8: is there enough gap from the caregiver's other shifts that day----------------------------
//中文：规则8——查这个护理员在同一天已经存在的所有排班记录（排除已取消的），
//检查待排的新 shift 跟每一条已有 shift 之间，前后间隔是否都 >= 0.5 小时。
//如果这天该护理员还没有任何 shift，直接通过，不需要比较。
/*Rule 8 — checks all of this caregiver's existing schedules on
//the same day (excluding cancelled ones), and checks that the new shift
//maintains at least a 0.5-hour gap before and after each existing shift.
//If the caregiver has no shifts that day yet, this check passes automatically.
*/
async function checkShiftGap(caregiverId, dateObj, startTime, endTime) {
    //??????????caregiver的 employeeCode?
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const existingShifts = await schedule.find({
        caregiver: caregiverId,
        date: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: "cancelled" }
    });

    if (existingShifts.length === 0) {
        return { ok: true }; //no shifts yet that day, nothing to compare against
    }

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const gapMinutes = MIN_SHIFT_GAP_HOURS * 60;

    for (const existing of existingShifts) {
        const existingStart = timeToMinutes(existing.startTime);
        const existingEnd = timeToMinutes(existing.endTime);

        // Only check the gap if the two shifts don't overlap and
        //have a clear before/after ordering; if they overlap outright, fail immediately.
        if (newStart >= existingEnd) {
            if (newStart - existingEnd < gapMinutes) {
                return {
                    ok: false,
                    conflictWith: existing,
                    reason: `only ${((newStart - existingEnd) / 60).toFixed(2)}h gap after existing shift ending ${existing.endTime}`
                };
            }
        } else if (existingStart >= newEnd) {
            if (existingStart - newEnd < gapMinutes) {
                return {
                    ok: false,
                    conflictWith: existing,
                    reason: `only ${((existingStart - newEnd) / 60).toFixed(2)}h gap before existing shift starting ${existing.startTime}`
                };
            }
        } else {
            return {
                ok: false,
                conflictWith: existing,
                reason: `overlaps with existing shift ${existing.startTime}-${existing.endTime}`
            };
        }
    }

    return { ok: true };
}

//-----------------assignScheduleToCaregiver----------------------------
//Runs all 8 rules in sequence and only creates the new schedule record if every rule passes.
const assignScheduleToCaregiver = async (req, res) => {
    try {
        console.log(`-----------assign Schedule To Caregiver---------`);
        const { clientCode, employeeCode, date, startTime, endTime } = req.body;

        //=========Rule 1: client must exist in the database========
        //confirm the client already exists in the database
        //(whether adding a new shift to an existing client, or scheduling a
        //newly-added client for the first time, the client record itself must pre-exist).
        const findClient = await client.findOne({ clientCode: clientCode });
        console.log(`client = ${clientCode} `);
        if (!findClient) {
            console.log(`Rule 1 failed: client ${clientCode} does not exist.`);
            return res.status(404).json({
                success: false,
                rule: 1,
                message: `Client ${clientCode} not found.` });
        }

        //=======Rule 2: client status must be active=============
        //the client's status must be active; clients who are deceased or have paused service should not be scheduled.
        if (findClient.status !== "active") {
            console.log(`Rule 2 failed: client ${clientCode} (${findClient.fullName}) status is "${findClient.status}".`);
            return res.status(400).json({
                success: false,
                rule: 2,
                message: `Client ${clientCode} (${findClient.fullName}) is not active (current status: "${findClient.status}").`
            });
        }

        const findCaregiver = await caregiver.findOne({ employeeCode: employeeCode });
        //===========Rule 3: caregiver status must be active==============
        //=the caregiver's status must be active; a caregiver who is on-leave or other status should not receive new shifts.
        if (!findCaregiver) {
            console.log(`Rule 3 failed: caregiver ${employeeCode} does not exist.`);
            return res.status(404).json({
                success: false,
                rule: 3,
                message: `Caregiver ${employeeCode} not found.`
            });
        }
        if (findCaregiver.status !== "active") {
            console.log(`Rule 3 failed: caregiver ${employeeCode} (${findCaregiver.fullName}) status is "${findCaregiver.status}".`);
            return res.status(400).json({
                success: false,
                rule: 3,
                message: `Caregiver ${employeeCode} (${findCaregiver.fullName}) is not active (current status: "${findCaregiver.status}").`
            });
        }

        //=====Rule 4: gender preference match(case-insensitive)=====
        //If the client has a caregiver gender preference other than "No Preference", the caregiver's gender must match it.
        if (findClient.preferredCaregiverGender !== "No Preference"
            && findClient.preferredCaregiverGender.toLowerCase !== findCaregiver.gender.toLowerCase) {
            console.log(`Rule 4 failed: client ${clientCode} prefers "${findClient.preferredCaregiverGender}",
                caregiver ${employeeCode} is "${findCaregiver.gender}".`);
            return res.status(400).json({
                success: false,
                rule: 4,
                message: `Client ${clientCode} prefers a "${findClient.preferredCaregiverGender}" caregiver,
                but ${employeeCode} is "${findCaregiver.gender}".`
            });
        }

        //=====Rule 5: caregiver's skills must cover all of the client's care needs(case-insensitive)=====
        //every one of the client's care needs must be present in the caregiver's skills list; missing even one disqualifies the match.
        const caregiverSkillsLower = findCaregiver.skills.map(s => s.toLowerCase());
        const missingSkills = findClient.careNeeds.filter(need => !caregiverSkillsLower.includes(need.toLowerCase()));
        if (missingSkills.length > 0) {
            console.log(`Rule 5 failed: caregiver ${employeeCode} is missing skills: ${missingSkills.join(", ")}.`);
            return res.status(400).json({
                success: false,
                rule: 5,
                message: `Caregiver ${employeeCode} (${findCaregiver.fullName}) does not have the required skill(s): ${missingSkills.join(", ")}.`
            });
        }

        //=====Rule 6: pet allergy check=====
        //if the client has pets, the caregiver must not have a pet allergy.
        if (findClient.hasPets && findCaregiver.hasPetAllergy) {
            console.log(`Rule 6 failed: client ${clientCode} has pets, caregiver ${employeeCode} has a pet allergy.`);
            return res.status(400).json({
                success: false,
                rule: 6,
                message: `Client ${clientCode} has pets, but caregiver ${employeeCode} (${findCaregiver.fullName}) has a pet allergy.`
            });
        }

        //=====Rule 7: requested shift must fall within the caregiver's availability=====
        //Get the weekday from the requested date,then check if any of the caregiver's availability blocks
        //fully cover the requested shift.
        const weekday = getWeekdayName(date);
        if (!isWithinAvailability(findCaregiver, weekday, startTime, endTime)) {
            console.log(`Rule 7 failed: caregiver ${employeeCode} has no availability on ${weekday} covering ${startTime}-${endTime}.`);
            return res.status(400).json({
                success: false,
                rule: 7,
                message: `Caregiver ${employeeCode} (${findCaregiver.fullName}) is not available on ${weekday} for ${startTime}-${endTime}.`
            });
        }

        //=====Rule 8: minimum gap from the caregiver's other shifts that day=====
        //Check that the requested shift has at least a 0.5-hour buffer from any other shift the caregiver has that day.
        //Pass automatically if there are no other shifts.
        const gapCheck = await checkShiftGap(findCaregiver._id, date, startTime, endTime);
        if (!gapCheck.ok) {
            console.log(`Rule 8 failed: caregiver ${employeeCode} shift conflict — ${gapCheck.reason}.`);
            return res.status(400).json({
                success: false,
                rule: 8,
                message: `Caregiver ${employeeCode} (${findCaregiver.fullName}) cannot take this shift: ${gapCheck.reason}.`
            });
        }

        //All 8 rules passed. Create the schedule with both parties' _id
        // references and the admin who created it (createdBy).
        const newSchedule = new schedule({
            client: findClient._id,
            caregiver: findCaregiver._id,
            date,
            startTime,
            endTime,
            createdBy: req.user.id
        });

        const savedSchedule = await newSchedule.save();

        await auditLog.create({
            actionType: 'schedule_update',
            oldValue: null,
            newValue: { clientCode, employeeCode, date, startTime, endTime },
            clientCode: findClient.clientCode,
            adminUser: req.user.id
        });

        console.log(`--------Schedule assigned successfully! All 8 rules passed.--------`);
        console.log(`Client (visit): ${findClient.clientCode} (${findClient.fullName})`);
        console.log(`Caregiver (shift): ${findCaregiver.employeeCode} (${findCaregiver.fullName})`);
        console.log(`Date: ${date}, Time: ${startTime} - ${endTime}`);

        return res.status(201).json({
            success: true,
            message: "Schedule assigned successfully.",
            data: {
                scheduleId: savedSchedule._id,
                clientCode: findClient.clientCode,
                clientName: findClient.fullName,
                caregiverEmployeeCode: findCaregiver.employeeCode,
                caregiverName: findCaregiver.fullName,
                date: savedSchedule.date,
                startTime: savedSchedule.startTime,
                endTime: savedSchedule.endTime
            }
        });

    } catch (error) {
        console.error("Error assigning schedule:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports = { assignScheduleToCaregiver };