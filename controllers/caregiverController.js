//-----------Business Logic-----------
//server/controllers/caregiverController.js
const Caregiver = require("../models/Caregiver");
const ComputeTravelTime = require("../utils/calculateTravelTime")
const computeLatLong = require("../utils/geocodeStructuredAddress")
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

        // Geocode the address to get latitude and longitude
        const { latitude, longitude } = await computeLatLong(address);
        newCaregiver.address.latitude = latitude;
        newCaregiver.address.longitude = longitude;

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
        const updateData = { ...req.body };

        const existingCaregiver = await Caregiver.findOne({
            employeeCode: caregiverId
        });

        if (!existingCaregiver) {
            return res.status(404).json({
                success: false,
                message: "Caregiver not found"
            });
        }

        // Prevent protected fields from being changed
        delete updateData._id;
        delete updateData.userId;
        delete updateData.employeeCode;

        //Update address and re-geocode if needed
        if (updateData.address) {
            const mergedAddress = {
                addressLine:
                    updateData.address.addressLine ??
                    existingCaregiver.address?.addressLine ??
                    "",
                town:
                    updateData.address.town ??
                    existingCaregiver.address?.town ??
                    "",
                city:
                    updateData.address.city ??
                    existingCaregiver.address?.city ??
                    "",
                county:
                    updateData.address.county ??
                    existingCaregiver.address?.county ??
                    "",
                postCode:
                    updateData.address.postCode ??
                    existingCaregiver.address?.postCode ??
                    ""
            };

            const addressChanged =
                mergedAddress.addressLine !== existingCaregiver.address?.addressLine ||
                mergedAddress.town !== existingCaregiver.address?.town ||
                mergedAddress.city !== existingCaregiver.address?.city ||
                mergedAddress.county !== existingCaregiver.address?.county ||
                mergedAddress.postCode !== existingCaregiver.address?.postCode;

            if (addressChanged) {
                const { latitude, longitude } =
                    await geocodeStructuredAddress(mergedAddress);

                updateData.address = {
                    ...mergedAddress,
                    latitude,
                    longitude
                };
            } else {
                delete updateData.address;
            }
        }

        // Update other fields
        Object.assign(existingCaregiver, updateData);

        await existingCaregiver.save();

        return res.status(200).json({
            success: true,
            message: "Caregiver updated successfully",
            data: existingCaregiver
        });
    } catch (error) {
        console.error("Error updating caregiver:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//------Delete caregiver by employeeCode (caregiverId)------
const deleteCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;

        const deletedCaregiver = await Caregiver.findOneAndDelete({ employeeCode: caregiverId });

        if (!deletedCaregiver) {
            return res.status(404).json({ success: false, message: "Caregiver not found" });
        }

        res.status(200).json({
            success: true,
            employeeCode: deletedCaregiver.employeeCode,
            message: "Caregiver deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting caregiver:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const computeTravel = async (req, res) => {
    try {
        const { origin, destination } = req.body

        if (!origin || !destination) {
            res.status(500).json({
                success: false,
                message: "Origin or desitnation coordinate is missing from the request."
            });
        } else {
            const travelDuration = await ComputeTravelTime(origin, destination)

            res.status(200).json({
                success: true,
                body: travelDuration
            });

        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }

}


module.exports = { createCaregiver, getAllCaregivers, getByCareGiverID, updateCaregiver, deleteCaregiver, computeTravel };