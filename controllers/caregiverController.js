//-----------Business Logic-----------
//server/controllers/caregiverController.js
const Caregiver = require("../models/Caregiver");

//--------Create a new caregiver--------
//controller handles request logic & database save
const createCaregiver = async (req, res) => {
    try {
        // Added userId, changed the locationCode to address
        const { userId, employeeCode, fullName, gender, age, address, phoneNumber, hasPetAllergy, skills, availability, status, } = req.body;

        const newCaregiver = new Caregiver({
            userId,
            employeeCode,
            fullName,
            gender,
            age,
            address,
            phoneNumber,
            hasPetAllergy,
            skills,
            availability,
            status,
    });

        const saved = await newCaregiver.save();
        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

//------Get all caregivers------
//fetch all caregivers records from MongoDB
const getAllCaregivers = async (req, res) => {
    try {
        //const caregivers = (await Caregiver.find()).sort({ createdAt: -1 });
        const caregivers = (await Caregiver.find()).sort();
        res.status(200).json({ success: true, data: caregivers });
    } catch (error) {
        console.error("Error fetching caregivers:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

//------Get caregiver by employeeCode (caregiverId)------
const getByCareGiverID = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;
        const caregiver = await Caregiver.findOne({ employeeCode: caregiverId });
        if (!caregiver) {
            return res.status(404).json({ success: false, message: "Caregiver not found" });
        }
        res.status(200).json({ success: true, data: caregiver });
    } catch (error) {
        console.error("Error fetching caregiver by ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

//------Update caregiver by employeeCode (caregiverId)------
const updateCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;
        const updateData = req.body;

        const updatedCaregiver = await Caregiver.findOneAndUpdate(
            { employeeCode: caregiverId },
            updateData,
            { new: true } // Return the updated document
        );

        if (!updatedCaregiver) {
            return res.status(404).json({ success: false, message: "Caregiver not found" });
        }

        res.status(200).json({ success: true, data: updatedCaregiver });
    } catch (error) {
        console.error("Error updating caregiver:", error);
        res.status(500).json({ success: false, message: error.message });
    }
}

//------Delete caregiver by employeeCode (caregiverId)------
const deleteCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;

        const deletedCaregiver = await Caregiver.findOneAndDelete({ employeeCode: caregiverId });

        if (!deletedCaregiver) {
            return res.status(404).json({ success: false, message: "Caregiver not found" });
        }

        res.status(200).json({ success: true, 
            employeeCode: deletedCaregiver.employeeCode,
            message: "Caregiver deleted successfully" });
    } catch (error) {
        console.error("Error deleting caregiver:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


module.exports = { createCaregiver, getAllCaregivers, getByCareGiverID, updateCaregiver, deleteCaregiver };