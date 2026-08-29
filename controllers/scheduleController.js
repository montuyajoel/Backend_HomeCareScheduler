//controllers/scheduleController.js
const schedule = require("../models/Schedule");
const client = require("../models/Client");
const caregiver = require("../models/Caregiver");
const auditLog = require("../models/AuditLog");
const user = require("../models/User");
const { ObjectId } = require("mongodb");
const { getStartOfDay, getEndOfDay } = require("../utils/irelandTime");
const {
    validateAssignment,
    evaluateCaregiversForSlot,
    validateBatchInternal,
    validateAssignmentBatch,
    evaluateCaregiversForBatch,
    normalizeSlots,
} = require("../services/scheduleValidationService");

const { assignScheduleToCaregiver } = require("./assignScheduleToCaregiverController.js");

const formatScheduleEntry = (doc) => ({
    scheduleId: doc._id,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    status: doc.status,
    notes: doc.notes,
    client: doc.client
        ? {
              clientCode: doc.client.clientCode,
              fullName: doc.client.fullName,
          }
        : null,
    caregiver: doc.caregiver
        ? {
              employeeCode: doc.caregiver.employeeCode,
              fullName: doc.caregiver.fullName,
          }
        : null,
});

const getMySchedules = async (req, res) => {
    try {
        console.log(`---------getMySchedules: Caregiver view their own  Schedules--------------`);
        const userId = req.user.id;

        const findCaregiver = await user.findOne({ _id: new ObjectId(userId) }).populate("caregiverId");
        if (!findCaregiver) {
            console.log(`getMySchedules failed: no caregiver profile linked to userId ${userId}.`);
            return res.status(404).json({
                success: false,
                message: `Caregiver not found for the authenticated user.`,
            });
        }

        const schedules = await schedule
            .find({ caregiver: findCaregiver.caregiverId })
            .populate("client", "fullName clientCode")
            .sort({ date: 1, startTime: 1 });

        if (!schedules || schedules.length === 0) {
            console.log(`No schedules found for caregiver userId ${userId}.`);
            return res.status(404).json({
                success: false,
                message: `No schedules found for the caregiver.`,
            });
        }

        console.log(`Fetched ${schedules.length} schedule(s) for caregiver userId ${userId}.`);

        res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules,
        });
    } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching schedules.",
        });
    }
};

const getSchedulesForCaregiver = async (req, res) => {
    try {
        const employeeCode = req.params.employeeCode;
        const { date } = req.query;

        const caregiverExists = await caregiver.findOne({ employeeCode: employeeCode });
        if (!caregiverExists) {
            console.log(`getSchedulesForCaregiver failed: caregiver ${employeeCode} does not exist.`);
            return res.status(404).json({ success: false, message: `Caregiver ${employeeCode} not found.` });
        }

        const query = {
            caregiver: caregiverExists._id,
            status: { $ne: "cancelled" },
        };
        if (date) {
            query.date = { $gte: getStartOfDay(date), $lte: getEndOfDay(date) };
        }

        const schedules = await schedule
            .find(query)
            .populate("client", "fullName clientCode")
            .sort({ date: 1, startTime: 1 });

        if (schedules.length === 0) {
            console.log(`No schedules found for caregiver ${employeeCode} (${caregiverExists.fullName}).`);
            return res.status(404).json({
                success: false,
                message: `No schedules found for caregiver ${employeeCode} (${caregiverExists.fullName}).`,
            });
        }

        console.log(`Fetched ${schedules.length} schedule(s) for caregiver ${employeeCode} (${caregiverExists.fullName}).`);

        return res.status(200).json({
            success: true,
            caregiverEmployeeCode: caregiverExists.employeeCode,
            caregiverName: caregiverExists.fullName,
            count: schedules.length,
            data: schedules,
        });
    } catch (error) {
        console.error("Error fetching schedules for caregiver:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching schedules for the caregiver.",
            error_details: error.message,
        });
    }
};

const getSchedulesByDate = async (req, res) => {
    try {
        const { date, start, end } = req.query;

        let dateFilter;
        if (date) {
            dateFilter = { $gte: getStartOfDay(date), $lte: getEndOfDay(date) };
        } else if (start && end) {
            dateFilter = { $gte: getStartOfDay(start), $lte: getEndOfDay(end) };
        } else {
            return res.status(400).json({
                success: false,
                message: "Provide ?date=YYYY-MM-DD or ?start=YYYY-MM-DD&end=YYYY-MM-DD",
            });
        }

        const schedules = await schedule
            .find({ date: dateFilter, status: { $ne: "cancelled" } })
            .populate("client", "fullName clientCode careNeeds status")
            .populate("caregiver", "fullName employeeCode status")
            .sort({ date: 1, startTime: 1 });

        return res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules.map(formatScheduleEntry),
        });
    } catch (error) {
        console.error("Error fetching schedules by date:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAvailableCaregivers = async (req, res) => {
    try {
        const { clientCode, date, startTime, endTime } = req.query;

        if (!clientCode || !date || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Required query params: clientCode, date, startTime, endTime",
            });
        }

        const findClient = await client.findOne({ clientCode });
        if (!findClient) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} not found.` });
        }

        const normalizedDate = getStartOfDay(date);
        const allCaregivers = await caregiver.find({ status: "active" });

        const { eligible, ineligible } = await evaluateCaregiversForSlot({
            clientDoc: findClient,
            caregivers: allCaregivers,
            date: normalizedDate,
            startTime,
            endTime,
        });

        return res.status(200).json({
            success: true,
            client: {
                clientCode: findClient.clientCode,
                fullName: findClient.fullName,
                careNeeds: findClient.careNeeds,
                preferredCaregiverGender: findClient.preferredCaregiverGender,
                hasPets: findClient.hasPets,
                status: findClient.status,
            },
            slot: { date: normalizedDate, startTime, endTime },
            eligible,
            ineligible,
            eligibleCount: eligible.length,
            ineligibleCount: ineligible.length,
        });
    } catch (error) {
        console.error("Error fetching available caregivers:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const validateScheduleAssignment = async (req, res) => {
    try {
        const { clientCode, employeeCode, date, startTime, endTime } = req.body;

        const findClient = await client.findOne({ clientCode });
        const findCaregiver = await caregiver.findOne({ employeeCode });

        if (!findClient) {
            return res.status(404).json({ success: false, rule: 1, message: `Client ${clientCode} not found.` });
        }
        if (!findCaregiver) {
            return res.status(404).json({ success: false, rule: 3, message: `Caregiver ${employeeCode} not found.` });
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
            return res.status(400).json({
                success: false,
                valid: false,
                rule: validation.rule,
                message: validation.message,
            });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            message: "Assignment is valid.",
        });
    } catch (error) {
        console.error("Error validating assignment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateSchedule = async (req, res) => {
    try {
        console.log(`-----------Update a schedule----------------`);
        const { scheduleId } = req.params;
        const { date, startTime, endTime, caregiver: caregiverId, employeeCode, status, notes } = req.body;

        const findSchedule = await schedule.findById(scheduleId);
        if (!findSchedule) {
            console.log(`updateSchedule failed: schedule ${scheduleId} does not exist.`);
            return res.status(404).json({
                success: false,
                message: `schedule ${scheduleId} does not exist.`,
            });
        }

        const clientExists = await client.findById(findSchedule.client);
        if (!clientExists) {
            console.log(`updateSchedule failed: client linked to schedule ${scheduleId} no longer exists.`);
            return res.status(404).json({
                success: false,
                message: `client linked to schedule ${scheduleId} not found.`,
            });
        }

        let resolvedCaregiverId = caregiverId ?? findSchedule.caregiver;
        if (employeeCode) {
            const cg = await caregiver.findOne({ employeeCode });
            if (!cg) {
                return res.status(404).json({ success: false, message: `Caregiver ${employeeCode} not found.` });
            }
            resolvedCaregiverId = cg._id;
        }

        const caregiverDoc = await caregiver.findById(resolvedCaregiverId);
        if (!caregiverDoc) {
            return res.status(404).json({ success: false, message: "Caregiver not found." });
        }

        const update = {
            date: date ? getStartOfDay(date) : findSchedule.date,
            startTime: startTime ?? findSchedule.startTime,
            endTime: endTime ?? findSchedule.endTime,
            caregiver: resolvedCaregiverId,
            status: status ?? findSchedule.status,
            notes: notes !== undefined ? notes : findSchedule.notes,
        };

        const current = {
            date: findSchedule.date?.toISOString?.() ?? findSchedule.date,
            startTime: findSchedule.startTime,
            endTime: findSchedule.endTime,
            caregiver: findSchedule.caregiver?.toString(),
            status: findSchedule.status,
            notes: findSchedule.notes,
        };

        const validation = await validateAssignment({
            clientDoc: clientExists,
            caregiverDoc,
            date: update.date,
            startTime: update.startTime,
            endTime: update.endTime,
            excludeScheduleId: findSchedule._id,
        });

        if (!validation.valid && update.status !== "cancelled") {
            return res.status(400).json({
                success: false,
                rule: validation.rule,
                message: validation.message,
            });
        }

        const newSnapshot = {
            date: update.date?.toISOString?.() ?? update.date,
            startTime: update.startTime,
            endTime: update.endTime,
            caregiver: update.caregiver?.toString(),
            status: update.status,
            notes: update.notes,
        };

        if (JSON.stringify(current) === JSON.stringify(newSnapshot)) {
            console.log(`updateSchedule: no changes detected for schedule ${scheduleId}.`);
            return res.status(400).json({
                success: false,
                message: `no changes detected for schedule ${scheduleId}.`,
            });
        }

        const updatedSchedule = await schedule.findByIdAndUpdate(scheduleId, update, { new: true });
        if (!updatedSchedule) {
            return res.status(404).json({
                success: false,
                message: `Schedule not found.`,
            });
        }

        await auditLog.create({
            actionType: "schedule_update",
            oldValue: findSchedule,
            newValue: update,
            clientCode: clientExists.clientCode,
            adminUser: req.user.id,
        });

        console.log(`--------Schedule updated successfully!--------`);
        console.log(`Schedule ID: ${scheduleId}, Client: ${clientExists.clientCode} (${clientExists.fullName})`);

        return res.status(200).json({
            success: true,
            message: "Schedule updated successfully.",
            data: {
                scheduleId: updatedSchedule._id,
                clientCode: clientExists.clientCode,
                clientName: clientExists.fullName,
                caregiverEmployeeCode: caregiverDoc.employeeCode,
                caregiverName: caregiverDoc.fullName,
                before: current,
                after: newSnapshot,
            },
        });
    } catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).json({
            success: false,
            message: `An error occurred while updating the schedule.`,
            error_details: error.message,
        });
    }
};

const cancelSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const findSchedule = await schedule.findById(scheduleId);
        if (!findSchedule) {
            return res.status(404).json({ success: false, message: "Schedule not found." });
        }

        if (findSchedule.status === "cancelled") {
            return res.status(400).json({ success: false, message: "Schedule is already cancelled." });
        }

        const clientExists = await client.findById(findSchedule.client);
        const updated = await schedule.findByIdAndUpdate(
            scheduleId,
            { status: "cancelled" },
            { new: true }
        );

        await auditLog.create({
            actionType: "schedule_update",
            oldValue: findSchedule,
            newValue: { status: "cancelled" },
            clientCode: clientExists?.clientCode,
            adminUser: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Schedule cancelled successfully.",
            data: { scheduleId: updated._id, status: updated.status },
        });
    } catch (error) {
        console.error("Error cancelling schedule:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const reassignSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { employeeCode } = req.body;

        if (!employeeCode) {
            return res.status(400).json({ success: false, message: "employeeCode is required." });
        }

        const findSchedule = await schedule.findById(scheduleId);
        if (!findSchedule) {
            return res.status(404).json({ success: false, message: "Schedule not found." });
        }

        if (findSchedule.status === "cancelled") {
            return res.status(400).json({ success: false, message: "Cannot reassign a cancelled schedule." });
        }

        const clientExists = await client.findById(findSchedule.client);
        if (!clientExists) {
            return res.status(404).json({ success: false, message: "Client linked to schedule not found." });
        }

        const newCaregiver = await caregiver.findOne({ employeeCode });
        if (!newCaregiver) {
            return res.status(404).json({ success: false, message: `Caregiver ${employeeCode} not found.` });
        }

        const validation = await validateAssignment({
            clientDoc: clientExists,
            caregiverDoc: newCaregiver,
            date: findSchedule.date,
            startTime: findSchedule.startTime,
            endTime: findSchedule.endTime,
            excludeScheduleId: findSchedule._id,
        });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                rule: validation.rule,
                message: validation.message,
            });
        }

        const oldCaregiver = await caregiver.findById(findSchedule.caregiver);
        const updated = await schedule.findByIdAndUpdate(
            scheduleId,
            { caregiver: newCaregiver._id, status: "scheduled" },
            { new: true }
        );

        await auditLog.create({
            actionType: "schedule_update",
            oldValue: { caregiver: oldCaregiver?.employeeCode },
            newValue: { caregiver: newCaregiver.employeeCode },
            clientCode: clientExists.clientCode,
            adminUser: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Schedule reassigned successfully.",
            data: {
                scheduleId: updated._id,
                clientCode: clientExists.clientCode,
                clientName: clientExists.fullName,
                caregiverEmployeeCode: newCaregiver.employeeCode,
                caregiverName: newCaregiver.fullName,
            },
        });
    } catch (error) {
        console.error("Error reassigning schedule:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAvailableCaregiversBatch = async (req, res) => {
    try {
        const { clientCode, slots } = req.body;

        if (!clientCode || !Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Required body: clientCode and slots array.",
            });
        }

        const findClient = await client.findOne({ clientCode });
        if (!findClient) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} not found.` });
        }

        const normalized = normalizeSlots(slots);
        const internal = validateBatchInternal(normalized);
        if (!internal.valid) {
            return res.status(400).json({ success: false, message: internal.message });
        }

        const allCaregivers = await caregiver.find({ status: "active" });
        const { eligible, ineligible, batchError } = await evaluateCaregiversForBatch({
            clientDoc: findClient,
            caregivers: allCaregivers,
            slots: normalized,
        });

        if (batchError) {
            return res.status(400).json({ success: false, message: batchError });
        }

        return res.status(200).json({
            success: true,
            client: {
                clientCode: findClient.clientCode,
                fullName: findClient.fullName,
                careNeeds: findClient.careNeeds,
                preferredCaregiverGender: findClient.preferredCaregiverGender,
                hasPets: findClient.hasPets,
                status: findClient.status,
            },
            slotCount: normalized.length,
            slots: normalized,
            eligible,
            ineligible,
            eligibleCount: eligible.length,
            ineligibleCount: ineligible.length,
        });
    } catch (error) {
        console.error("Error fetching available caregivers batch:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const validateScheduleAssignmentBatch = async (req, res) => {
    try {
        const { clientCode, employeeCode, slots } = req.body;

        const findClient = await client.findOne({ clientCode });
        const findCaregiver = await caregiver.findOne({ employeeCode });

        if (!findClient) {
            return res.status(404).json({ success: false, rule: 1, message: `Client ${clientCode} not found.` });
        }
        if (!findCaregiver) {
            return res.status(404).json({ success: false, rule: 3, message: `Caregiver ${employeeCode} not found.` });
        }

        const batchResult = await validateAssignmentBatch({
            clientDoc: findClient,
            caregiverDoc: findCaregiver,
            slots,
        });

        if (!batchResult.valid) {
            return res.status(400).json({
                success: false,
                valid: false,
                rule: batchResult.rule,
                message: batchResult.message,
            });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            message: "All slots are valid for this assignment.",
            slotCount: batchResult.slots.length,
        });
    } catch (error) {
        console.error("Error validating batch assignment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const assignScheduleBatch = async (req, res) => {
    try {
        const { clientCode, employeeCode, slots, notes } = req.body;

        if (!clientCode || !employeeCode || !Array.isArray(slots) || slots.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Required body: clientCode, employeeCode, and slots array.",
            });
        }

        const findClient = await client.findOne({ clientCode });
        const findCaregiver = await caregiver.findOne({ employeeCode });

        if (!findClient) {
            return res.status(404).json({ success: false, rule: 1, message: `Client ${clientCode} not found.` });
        }
        if (!findCaregiver) {
            return res.status(404).json({ success: false, rule: 3, message: `Caregiver ${employeeCode} not found.` });
        }

        const batchResult = await validateAssignmentBatch({
            clientDoc: findClient,
            caregiverDoc: findCaregiver,
            slots,
        });

        if (!batchResult.valid) {
            return res.status(400).json({
                success: false,
                rule: batchResult.rule,
                message: batchResult.message,
            });
        }

        const results = [];

        for (const slot of batchResult.slots) {
            const normalizedDate = getStartOfDay(slot.date);
            const newSchedule = new schedule({
                client: findClient._id,
                caregiver: findCaregiver._id,
                date: normalizedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                notes: notes || undefined,
                createdBy: req.user.id,
            });

            const saved = await newSchedule.save();
            results.push({
                date: normalizedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                scheduleId: saved._id,
                status: "created",
            });
        }

        await auditLog.create({
            actionType: "schedule_update",
            oldValue: null,
            newValue: {
                clientCode,
                employeeCode,
                slotCount: batchResult.slots.length,
                slots: batchResult.slots,
                notes,
            },
            clientCode: findClient.clientCode,
            adminUser: req.user.id,
        });

        return res.status(201).json({
            success: true,
            message: `${results.length} schedule(s) assigned successfully.`,
            created: results.length,
            failed: 0,
            clientCode: findClient.clientCode,
            clientName: findClient.fullName,
            caregiverEmployeeCode: findCaregiver.employeeCode,
            caregiverName: findCaregiver.fullName,
            results,
        });
    } catch (error) {
        console.error("Error assigning schedule batch:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    assignScheduleToCaregiver,
    getMySchedules,
    getSchedulesForCaregiver,
    getSchedulesByDate,
    getAvailableCaregivers,
    validateScheduleAssignment,
    updateSchedule,
    cancelSchedule,
    reassignSchedule,
    getAvailableCaregiversBatch,
    validateScheduleAssignmentBatch,
    assignScheduleBatch,
};
