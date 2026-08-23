/*AssignScheduleToCaregiver handles the core function of scheduling, which an admin assigns a
client's needed care period (called a "visit" from the client's side,
a "shift" from the caregiver's side) to a caregiver. Before creating the
record, it must pass all validation rules in sequence, any failure
stops immediately with a specific reason.*/

const schedule = require("../models/Schedule");
const client = require("../models/Client");
const caregiver = require("../models/Caregiver");
const auditLog = require("../models/AuditLog");
const { getStartOfDay } = require("../utils/irelandTime");
const { validateAssignment } = require("../services/scheduleValidationService");

const assignScheduleToCaregiver = async (req, res) => {
    try {
        console.log(`-----------assign Schedule To Caregiver---------`);
        const { clientCode, employeeCode, date, startTime, endTime, notes } = req.body;

        const findClient = await client.findOne({ clientCode: clientCode });
        if (!findClient) {
            console.log(`Rule 1 failed: client ${clientCode} does not exist.`);
            return res.status(404).json({
                success: false,
                rule: 1,
                message: `Client ${clientCode} not found.`,
            });
        }

        const findCaregiver = await caregiver.findOne({ employeeCode: employeeCode });
        if (!findCaregiver) {
            console.log(`Rule 3 failed: caregiver ${employeeCode} does not exist.`);
            return res.status(404).json({
                success: false,
                rule: 3,
                message: `Caregiver ${employeeCode} not found.`,
            });
        }

        const normalizedDate = getStartOfDay(date);
        const validation = await validateAssignment({
            clientDoc: findClient,
            caregiverDoc: findCaregiver,
            date: normalizedDate,
            startTime,
            endTime,
        });

        if (!validation.valid) {
            console.log(`Rule ${validation.rule} failed: ${validation.message}`);
            return res.status(400).json({
                success: false,
                rule: validation.rule,
                message: validation.message,
            });
        }

        const newSchedule = new schedule({
            client: findClient._id,
            caregiver: findCaregiver._id,
            date: normalizedDate,
            startTime,
            endTime,
            notes: notes || undefined,
            createdBy: req.user.id,
        });

        const savedSchedule = await newSchedule.save();

        await auditLog.create({
            actionType: "schedule_update",
            oldValue: null,
            newValue: { clientCode, employeeCode, date: normalizedDate, startTime, endTime, notes },
            clientCode: findClient.clientCode,
            adminUser: req.user.id,
        });

        console.log(`--------Schedule assigned successfully! All rules passed.--------`);
        console.log(`Client (visit): ${findClient.clientCode} (${findClient.fullName})`);
        console.log(`Caregiver (shift): ${findCaregiver.employeeCode} (${findCaregiver.fullName})`);
        console.log(`Date: ${normalizedDate}, Time: ${startTime} - ${endTime}`);

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
                endTime: savedSchedule.endTime,
                notes: savedSchedule.notes,
            },
        });
    } catch (error) {
        console.error("Error assigning schedule:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = { assignScheduleToCaregiver };
