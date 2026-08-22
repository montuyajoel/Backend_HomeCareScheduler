//controllers/scheduleController.js
/*This file handles all schedule-related operations:
assigning a client to a caregiver, caregiver views one's own schedule, admin views a specific caregiver's schedules (admin view), and
updating an existing schedule record. Every update writes an audit log entry via AuditLog. */
const schedule = require("../models/Schedule");
const client= require("../models/Client");
const caregiver = require("../models/Caregiver");
const auditLog = require("../models/AuditLog");
const user = require("../models/User");

const { ObjectId } = require('mongodb');



//------------------assign Schedule To Caregiver---------------
const { assignScheduleToCaregiver }
= require("./assignScheduleToCaregiverController.js");

/*
//！！！！！！！！！！！！！这里的排班没有任何筛选！！！！！最重要的功能
//Assigns a client to a caregiver by creating a new schedule record.
const assignScheduleToCaregiver = async (req, res) => {
    try {
        console.log(`-----------assign Schedule To Caregiver---------`);
        const { clientCode, employeeCode, date, startTime, endTime } = req.body;

        const findClient = await client.findOne({clientCode:clientCode})
        const findCaregiver = await caregiver.findOne({employeeCode:employeeCode})

        //------------------All Checks----------------
        if(!findClient) {
            console.log(`Assign schedule failed: client ${clientCode} does not exist.`);
            res.status(404).json({
                success:false,
                message:`Client ${clientCode} not found.`
            })
        }
        else if(findClient.status !== "active") {
            console.log(`Assign schedule failed:
                client ${clientCode} (${findClient.fullName}) has status "${findClient.status}",
                not active.`);

            res.status(400).json({
                success: false,
                message: `Client ${clientCode} (${findClient.fullName}) is not active (current status: "${findClient.status}").`
            })
        }

        if(!findCaregiver) {
            console.log(`Assign schedule failed: caregiver ${employeeCode} does not exist.`);
            res.status(404).json({
                success: false,
                message: `Caregiver ${employeeCode} not found.`
            })
        }
        else if (findCaregiver.status !== "active") {
            console.log(`Assign schedule failed: caregiver ${employeeCode} (${findCaregiver.fullName}) has status "${findCaregiver.status}", not active.`);
            res.status(400).json({
                success: false,
                message: `Caregiver ${employeeCode} (${findCaregiver.fullName}) is not active (current status: "${findCaregiver.status}").`
            })
        }
        //------After all checks pass, creating the new schedule--------
        //store the client's and caregiver's MongoDB _id references
        const newSchedule = new schedule({
            client: findClient._id,
            caregiver: findCaregiver._id,
            date,
            startTime,
            endTime
        });

        const savedSchedule = await newSchedule.save();

        console.log(`--------Schedule assigned successfully!--------`);
        console.log(`Client: ${findClient.clientCode} (${findClient.fullName})`);
        console.log(`Caregiver: ${findCaregiver.employeeCode} (${findCaregiver.fullName})`);
        console.log(`Date: ${date}, Time: ${startTime} - ${endTime}`);

        //---------------------------------
        /*res.status(201).json({
            success: true,
            message: "Schedule assigned successfully.", data: savedSchedule
        })；
        
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

        //-----------------------
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
} */


//------------Caregiver view their own  Schedules-------------------
//A caregiver views their own schedules, resolves the logged in
//user's id to their caregiver profile, then queries schedules for that caregiver.

const getMySchedules = async (req, res) => {
    try {

        console.log(`---------getMySchedules: Caregiver view their own  Schedules--------------`);
        const userId = req.user.id; // the logged-in user's ID is stored in req.user.id, from the JWT

        //the User document only stores the caregiverId foreign key,
        //so populate() is needed to resolve the full Caregiver profile
        const findCaregiver = await user.findOne({ _id: new ObjectId(userId) }).populate('caregiverId');
        if(!findCaregiver){
            console.log(`getMySchedules failed: no caregiver profile linked to userId ${userId}.`);
            return res.status(404).json({
                success: false,
                message: `Caregiver not found for the authenticated user.`
            });
        }

        const schedules = await schedule.find({ caregiver: findCaregiver.caregiverId })
            .populate('client', 'name clientCode') // Populate client details (name and clientCode)
            .sort({ date: 1, startTime: 1 }); // Sort ascending by date and start time

        if (!schedules || schedules.length === 0) {

            console.log(`No schedules found for caregiver userId ${userId}.`);
            return res.status(404).json({
                success: false,
                message: `No schedules found for the caregiver.`
            });
        }

        console.log(`Fetched ${schedules.length} schedule(s) for caregiver userId ${userId}.`);
        
        res.status(200).json({
            success: true, count: schedules.length, data: schedules
        });

    } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while fetching schedules."
        });
    }
}


//-----------------getSchedulesForCaregiver: get schedules for a specific caregiver by their ID----------------------------
//An admin looks up all schedules for a specific caregiver by employeeCode.
const getSchedulesForCaregiver = async (req, res) => {
    try {
        //const caregiverId = req.params.caregiverId; // Get caregiver ID from request parameters
        const employeeCode = req.params.employeeCode;
        const { date } = req.query;
        
        const caregiverExists = await caregiver.findOne({employeeCode: employeeCode});
        if(!caregiverExists){
            //return res.status(404).json({ success: false, message: "Caregiver not found." });
            console.log(`getSchedulesForCaregiver failed: caregiver ${employeeCode} does not exist.`);
            return res.status(404).json({ success: false,
                message: `Caregiver ${employeeCode} not found.` });
        }

        const schedules = await schedule.find({ caregiver: caregiverExists._id })
            .populate('client', 'name clientCode') // Populate client details (name and clientCode)
            .sort({ date: 1, startTime: 1 }); // Sort by date and start time
        
        if (schedules.length === 0) {
            console.log(`No schedules found for caregiver ${employeeCode} (${caregiverExists.fullName}).`);
            return res.status(404).json({
                success: false,
                message: `No schedules found for caregiver ${employeeCode} (${caregiverExists.fullName}).`});
        }

        console.log(`Fetched ${schedules.length} schedule(s) for caregiver ${employeeCode} (${caregiverExists.fullName}).`);
        
        //res.status(200).json({ success: true, data: schedules });
        return res.status(200).json({
            success: true,
            caregiverEmployeeCode: caregiverExists.employeeCode,
            caregiverName: caregiverExists.fullName,
            count: schedules.length,
            data: schedules
        });

    } catch (error) {
        console.error("Error fetching schedules for caregiver:", error);
        res.status(500).json({ success: false,
            message: "An error occurred while fetching schedules for the caregiver.",
            "error_details": error.message
        });
    }
}

//-----------------updateSchedule----------------------------
//Updates an existing schedule record (date, time, caregiver, status).
//If nothing actually changed， Rejects the update; writes an audit log entry on success.
const updateSchedule = async (req, res) => {
    try {
        console.log(`-----------Update a schedule----------------`);
        const { scheduleId } = req.params;
        const { date, startTime, endTime, caregiver, status } = req.body;
        
        const findSchedule = await schedule.findById(scheduleId);
        if (!findSchedule) {
            console.log(`updateSchedule failed: schedule ${scheduleId} does not exist.`);
            return res.status(404).json({
                success: false,
                message: `schedule ${scheduleId} does not exist.` });
        }

        const clientExists = await client.findById(findSchedule.client);
        if (!clientExists) {
            console.log(`updateSchedule failed: client linked to schedule ${scheduleId} no longer exists.`);
            return res.status(404).json({
                success: false,
                message: `client linked to schedule ${scheduleId} not found.` });
        }
        
        //If a field isn't provided in the request, keep the existing value
        //(?? means "use the right-hand value only if the left-hand one is null/undefined")
        const update = {
            date: date ?? findSchedule.date,
            startTime: startTime ?? findSchedule.startTime,
            endTime: endTime ?? findSchedule.endTime,
            caregiver: caregiver ?? findSchedule.caregiver,
            status: status ?? findSchedule.status
        };

        const current = {
            date: findSchedule.date?.toISOString?.() ?? findSchedule.date,
            startTime: findSchedule.startTime,
            endTime: findSchedule.endTime,
            caregiver: findSchedule.caregiver?.toString(),
            status: findSchedule.status
        };
        //Convert the old vs new to strings, compare those two strings. If identical, this request
        //didn't change anything, so reject it early to avoid a no-op audit entry.
        if (JSON.stringify(current) === JSON.stringify(update)) {
            console.log(`updateSchedule: no changes detected for schedule ${scheduleId}.`);
            return res.status(400).json({
                success: false,
                message: `no changes detected for schedule ${scheduleId}.`
            });
        }

        const updatedSchedule = await schedule.findByIdAndUpdate(
            scheduleId,
            { date, startTime, endTime, caregiver, status },
            { new: true }
        );
        if (!updatedSchedule) {
            return res.status(404).json({
                success: false, message: `Schedule not found.` });
        }

        //"await". Without it, the response could be sent
        //before this audit log entry actually finishes writing to the database
        await auditLog.create({
            actionType: 'schedule_update',
            oldValue: findSchedule, // You can store the old value if needed
            newValue: { date, startTime, endTime, caregiver, status },
            clientCode: clientExists.clientCode,
            adminUser: req.user.id, //the logged-in user's ID is stored in req.user.id, from the JWT
        });

        console.log(`--------Schedule updated successfully!--------`);
        console.log(`Schedule ID: ${scheduleId}, Client: ${clientExists.clientCode} (${clientExists.fullName})`);
        console.log(`Before: ${JSON.stringify(current)}`);
        console.log(`After:  ${JSON.stringify(update)}`);

        //res.status(200).json({ success: true, data: updatedSchedule });
        return res.status(200).json({
            success: true,
            message: "Schedule updated successfully.",
            data: {
                scheduleId: updatedSchedule._id,
                clientCode: clientExists.clientCode,
                clientName: clientExists.fullName,
                before: current,
                after: update
            }
        });
    } catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).json({
            success: false,
            message: `An error occurred while updating the schedule.`,
            "error_details": error.message
        });
    }
}

module.exports = {
    assignScheduleToCaregiver,
    getMySchedules,
    getSchedulesForCaregiver,
    updateSchedule
};