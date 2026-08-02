const schedule = require("../models/Schedule");
const client= require("../models/Client");
const caregiver = require("../models/Caregiver");
const auditLog = require("../models/AuditLog");
const user = require("../models/User");

const { ObjectId } = require('mongodb');

// Controller function to assign a schedule to a caregiver
const assignScheduleToCaregiver = async (req, res) => {
    try {
        const { clientCode, employeeCode, date, startTime, endTime } = req.body;

        const findClient = await client.findOne({clientCode:clientCode})
        const findCaregiver = await caregiver.findOne({employeeCode:employeeCode})

        if(!findClient)(
            res.status(404).json({"success":false, "message":"Client not found."})
        )
        else if(findClient.status !== "active")(
            res.status(400).json({"success":false, "message":"Client is not active."})
        )

        if(!findCaregiver)(
             res.status(404).json({"success":false, "message":"Caregiver not found."})
        )
        else if(findCaregiver.status !== "active")(
            res.status(400).json({"success":false, "message":"Caregiver is not active."})
        )

        const newSchedule = new schedule({
            client: findClient._id,
            caregiver: findCaregiver._id,
            date,
            startTime,
            endTime
        });

        const savedSchedule = await newSchedule.save();
        res.status(201).json({ success: true, message: "Schedule assigned successfully.", data: savedSchedule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

//
const getMySchedules = async (req, res) => {
    try {
        const userId = req.user.id; // Assuming the authenticated user's ID is stored in req.user.id

        const findCaregiver = await user.findOne({_id: new ObjectId(userId)}).populate('caregiverId');
        if(!findCaregiver){
            return res.status(404).json({ success: false, message: "Caregiver not found for the authenticated user." });
        }

        const schedules = await schedule.find({ caregiver: findCaregiver.caregiverId })
            .populate('client', 'name clientCode') // Populate client details (name and clientCode)
            .sort({ date: 1, startTime: 1 }); // Sort by date and start time

        if (!schedules || schedules.length === 0) {
            return res.status(404).json({ success: false, message: "No schedules found for the caregiver." });
        }

        res.status(200).json({ success: true, data: schedules });
    } catch (error) {
        console.error("Error fetching schedules:", error);
        res.status(500).json({ success: false, message: "An error occurred while fetching schedules." });
    }
}

// Controller function to get schedules for a specific caregiver by their ID
const getSchedulesForCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId; // Get caregiver ID from request parameters
    
        const caregiverExists = await caregiver.findOne({employeeCode: caregiverId});
        if(!caregiverExists){
            return res.status(404).json({ success: false, message: "Caregiver not found." });
        }

        const schedules = await schedule.find({ caregiver: caregiverExists._id })
            .populate('client', 'name clientCode') // Populate client details (name and clientCode)
            .sort({ date: 1, startTime: 1 }); // Sort by date and start time
        
        if (schedules.length === 0) {
            return res.status(404).json({ success: false, message: "No schedules found for this caregiver." });
        }
        
        res.status(200).json({ success: true, data: schedules });
    } catch (error) {
        console.error("Error fetching schedules for caregiver:", error);
        res.status(500).json({ success: false, message: "An error occurred while fetching schedules for the caregiver.",
            "error_details": error.message
         });
    }   
}

// Controller function to update a schedule
const updateSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { date, startTime, endTime, caregiver, status } = req.body;
        
        const findSchedule = await schedule.findById(scheduleId);
        if (!findSchedule) {
            return res.status(404).json({ success: false, message: "Schedule not found." });
        }
       
        const clientExists = await client.findById(findSchedule.client);
        if (!clientExists) {
            return res.status(404).json({ success: false, message: "Associated client not found." });
        }
        
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

        if (JSON.stringify(current) === JSON.stringify(update)) {
        return res.status(400).json({ success: false, message: "No changes detected in the schedule." });
        }

        const updatedSchedule = await schedule.findByIdAndUpdate(scheduleId, { date, startTime, endTime, caregiver, status }, { new: true });
        if (!updatedSchedule) {
            return res.status(404).json({ success: false, message: "Schedule not found." });
        }


        auditLog.create({
            actionType: 'schedule_update',
            oldValue: findSchedule, // You can store the old value if needed
            newValue: { date, startTime, endTime, caregiver, status },
            clientCode: clientExists.clientCode,
            adminUser: req.user.id, // Assuming the authenticated user's ID is stored in req.user.id
        });
        res.status(200).json({ success: true, data: updatedSchedule });
    } catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).json({ success: false, message: "An error occurred while updating the schedule.",
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
