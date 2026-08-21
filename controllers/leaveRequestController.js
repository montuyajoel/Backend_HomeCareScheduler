const LeaveRequest = require("../models/LeaveRequests");
const Caregiver = require("../models/Caregiver");
const User = require("../models/User");
const Schedule = require("../models/Schedule");
const {ObjectId} = require("mongodb");
const mongoose = require("mongoose");

const CheckLeaveRequestOverlap = async (caregiverId, startDate, endDate) => {
    try {
        const existingLeaveRequest = await LeaveRequest.findOne({
            employeeCode: caregiverId,
            $or: [
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } },
                { startDate: { $lte: new Date(startDate) }, endDate: { $gte: new Date(startDate) } },
                { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(endDate) } }
            ]
        });
        return existingLeaveRequest;
    } catch (error) {
        console.error("Error checking leave request overlap:", error);
        throw error;
    }
}

const getCaregiverByUserId = async (userId) => {
    const user = await User.findOne({ _id: new ObjectId(userId) });
    if (!user) {
        throw new Error("User not found");
    }

    return await Caregiver.findOne({ _id: new ObjectId(user.caregiverId) });
};//helper

// Create a new leave request
const createLeaveRequest = async (req, res) => {
    try {
        const { employeeCode, startDate, endDate, reason } = req.body;
        
        // if vacation leave, apply 2 weeks notice rule
        if (req.body.leaveType === "vacation") {
            const currentDate = new Date();
            const noticePeriod = 14; // 2 weeks in days
            const noticeDate = new Date(currentDate.getTime() + noticePeriod * 24 * 60 * 60 * 1000);
            
            if (new Date(startDate) < noticeDate) {
                return res.status(400).json({ success: false, message: "Vacation leave requests must be submitted at least 2 weeks in advance. You can ask for emergency leave if needed." });
            }
        }

        // if sick, emergency, or other, the caregiver must provide a reason
        if ((req.body.leaveType === "sick" || req.body.leaveType === "emergency" || req.body.leaveType === "other") && (!reason || reason.trim() === "")) {
            return res.status(400).json({ success: false, message: "Kindly provide a reason for sick, emergency, or other leave types." });
        }

        // Validate that startDate is before endDate
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ success: false, message: "Start date must be before end date." });
        }

        // check if leave span applied is more than 30 days
        const leaveSpan = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24); // in days
        if (leaveSpan > 30) {
            return res.status(400).json({
                success: false,
                message: "Your leave request is longer than one month. Please double-check your start and end dates before submitting." });
        }
        
        // Check for overlapping leave request
        const existingLeaveRequest = await CheckLeaveRequestOverlap(employeeCode, startDate, endDate);

        if (existingLeaveRequest) {
            return res.status(400).json({ success: false, message: "You already have a leave request that overlaps with the requested dates." });
        }


        const newLeaveRequest = new LeaveRequest({
            employeeCode,
            leaveType: req.body.leaveType,
            startDate,
            endDate,
            reason,
        });

        const savedLeaveRequest = await newLeaveRequest.save();
        res.status(201).json({ success: true, message: "Leave request created successfully.", data: savedLeaveRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// get leave requests with optional status filter
const getLeaveRequests = async (req, res) => {
    try {
        const { status } = req.query; // Get the status from query parameters

        let query = {};
        if (status) {
            query.status = status.toLowerCase(); // Filter by status if provided
        }else{
            query.status = { $in: ['pending', 'approved', 'rejected', 'cancelled'] }; // Default to all statuses if not provided
        }
        // get full name of caregiver from employeeCode
        const leaveRequests = await LeaveRequest.find(query).populate('employeeCode').sort({ startDate: 1 });
        const caregivers = await Caregiver.find({ employeeCode: { $in: leaveRequests.map(lr => lr.employeeCode) } });

        leaveRequests.forEach(lr => {
            const caregiver = caregivers.find(c => c.employeeCode === lr.employeeCode);
            if (caregiver) {
                lr.fullName = caregiver.fullName;
            }
        });

        if (!leaveRequests || leaveRequests.length === 0) {
            //return res.status(404).json({ success: false, message: "No leave requests found." });
            return res.status(200).json({
                success: true,
                message: "No leave requests found."
            });
        }

        // Sort leave requests by startDate in ascending order
        leaveRequests.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        // Return pending leave requests first, then approved, then rejected
        leaveRequests.sort((a, b) => {
            const statusOrder = { 'pending': 1, 'approved': 2, 'rejected': 3 };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        res.status(200).json({ success: true, data: leaveRequests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

//Update leave request status by admin
const updateLeaveRequestStatus = async (req, res) => {
    try {
        const { status, adminNotes, leaveRequestId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(leaveRequestId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid leave request ID."
            });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be approved or rejected."
            });
        }

        const leaveRequest = await LeaveRequest.findById(leaveRequestId);

        if (!leaveRequest) {
            return res.status(404).json({
                success: false,
                message: "Leave request not found."
            });
        }

        leaveRequest.status = status;
        leaveRequest.adminNotes = adminNotes || "";
        leaveRequest.reviewedAt = new Date();
        leaveRequest.approvedBy = req.user.id//Assuming req.user.id contains the admin's id

        await leaveRequest.save();

        return res.status(200).json({
            success: true,
            message: `Leave request ${status} successfully.`,
            data: leaveRequest
        });
    } catch (error) {
        console.error("Error updating leave request status:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update leave request status."
        });
    }
};

// Allow caregiver to update the date and status if they want to cancel their leave request as long as it is still pending
const updateLeaveRequestCaregiver = async (req, res) => {
    try {
        //req.query should contain type cancel or change_date
        const { type } = req.query;
        const { leaveRequestId } = req.params;

        if (!type || (type !== "cancel" && type !== "change_date")) {
            return res.status(400).json({
                success: false,
                message: "Invalid request type. Use 'cancel' or 'change_date'."
            });
        }

        if(type === "change_date" && (!req.body.startDate || !req.body.endDate)){
            return res.status(400).json({ success: false, message: "For changing dates, both startDate and endDate are required." });
        }
        if(type === "change_date" && new Date(req.body.startDate) > new Date(req.body.endDate)){
            return res.status(400).json({ success: false, message: "Start date must be before end date." });
        }
        if(type === "change_date" && ((new Date(req.body.endDate) - new Date(req.body.startDate)) / (1000 * 60 * 60 * 24) > 30)){
            return res.status(400).json({ success: false, message: "Your leave request is longer than one month. Please double-check your start and end dates before submitting." });
        }

        const { caregiverCode, startDate, endDate } = req.body;

        const leaveRequest = await LeaveRequest.findById(new ObjectId(leaveRequestId));

        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }

        // Check if the caregiver is the owner of the leave request
        /*if (leaveRequest.employeeCode  !== caregiverCode) {
            return res.status(403).json({ success: false, message: "You are not authorized to update this leave request." });
        }*/

        // Allow caregiver to cancel their leave request if it is still pending
        if (leaveRequest.status === "pending" && type === "cancel") {
            leaveRequest.status = "cancelled";
            const updatedLeaveRequest = await leaveRequest.save();
            return res.status(200).json({ success: true, message: "Leave request cancelled successfully.", data: updatedLeaveRequest });
        } else if (leaveRequest.status === "pending" && type === "change_date") {
            if(leaveRequest.leaveType === "vacation"){
                const currentDate = new Date();
                const noticePeriod = 14; // 2 weeks in days
                const noticeDate = new Date(currentDate.getTime() + noticePeriod * 24 * 60 * 60 * 1000);
                
                if (new Date(startDate) < noticeDate) {
                    return res.status(400).json({ success: false, message: "Vacation leave requests must be submitted at least 2 weeks in advance. You can ask for emergency leave if needed." });
                }
            }
            // Check for overlapping leave requests
            const existingLeaveRequest = await CheckLeaveRequestOverlap(caregiverCode, startDate, endDate);

            //If there's an existing leave request that overlaps
            //and it's not the current one being updated, return an error
            if (existingLeaveRequest && existingLeaveRequest._id.toString() !== leaveRequestId) {
                return res.status(400).json({ success: false, message: "You already have a leave request that overlaps with the requested dates." });
            }

            //if (existingLeaveRequest) {
            //    return res.status(400).json({ success: false, message: "You already have a leave request that overlaps with the requested dates." });
            //}

            // Allow caregiver to update the start and end dates if needed
            leaveRequest.startDate = startDate || leaveRequest.startDate;
            leaveRequest.endDate = endDate || leaveRequest.endDate;
            const updatedLeaveRequest = await leaveRequest.save();
            return res.status(200).json({ success: true, message: "Leave request dates updated successfully.", data: updatedLeaveRequest });
        } else {
            return res.status(400).json({ success: false, message: "Only pending leave requests can be cancelled." });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Getting leave request by employeeCode (caregiver)
const getLeaveRequestById = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const leaveRequest = await LeaveRequest.find({ employeeCode: employeeId }).sort({ startDate: 1 });
        if (!leaveRequest) {
            return res.status(404).json({ success: false, message: "Leave request not found." });
        }
        res.status(200).json({ success: true, data: leaveRequest });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Check the affected shifts for the caregiver's leave request
const checkAffectedShifts = async (req, res) => {
    try {
        const { employeeCode, startDate, endDate } = req.query; // Assuming the request body contains employeeCode, startDate, and endDate
    
        // Validate that startDate is before endDate
        if (new Date(startDate) > new Date(endDate)) {
            return res.status(400).json({ success: false, message: "Start date must be before end date." });
        }

        const caregiverId = await Caregiver.findOne({ employeeCode: employeeCode });
        if (!caregiverId) {
            return res.status(404).json({ success: false, message: "Caregiver not found." });
        }

        // Find shifts that overlap with the leave request dates for the caregiver
        const leaveStartDate = new Date(startDate);
        leaveStartDate.setUTCHours(0, 0, 0, 0);

        const leaveEndDate = new Date(endDate);
        leaveEndDate.setUTCDate(leaveEndDate.getUTCDate() + 1);
        leaveEndDate.setUTCHours(0, 0, 0, 0);

        // Find affected shifts for the caregiver within the leave request dates
        const affectedShifts = await Schedule.find({
            caregiver: new ObjectId(caregiverId._id),
            date: {
                $gte: leaveStartDate,
                $lt: leaveEndDate,
            },
            status: {
                $ne: "cancelled",
            },
        })
        .populate("client", "clientCode fullName address")
        .sort({
            date: 1,
            startTime: 1,
        });

        // Return the affected shifts if any, otherwise return a message indicating no affected shifts
        if (affectedShifts && affectedShifts.length > 0) {
            affectedShifts.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
            res.status(200).json({ success: false, data: affectedShifts });
        }
        else {
            return res.status(200).json({
                success: true,
                message: "No affected shifts found for the caregiver's leave request." });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}


//get my leave requests for the logged in caregiver
const getMyLeaveRequests = async (req, res) => {
    try {
        const id = req.user?.id;
        const caregiver = await getCaregiverByUserId(id);
        if (!caregiver) {
            return res.status(404).json({ success: false, message: "Caregiver not found for the logged-in user." });
        }

        const leaveRequests = await LeaveRequest.find({ employeeCode: caregiver.employeeCode }).sort({ startDate: 1 });

        if (!leaveRequests || leaveRequests.length === 0) {
            return res.status(404).json({ success: false, message: "No leave requests found for the caregiver." });
        }

        res.status(200).json({ success: true, data: leaveRequests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createLeaveRequest,
    getLeaveRequests, //admin
    updateLeaveRequestStatus,
    getLeaveRequestById,
    getMyLeaveRequests,  //caregiver
    updateLeaveRequestCaregiver,
    checkAffectedShifts
};