//..controllers/careplanController.js
/*This file contains the actions about Client's careplan. Careplan is a pdf document which includes all information of the client.
Only admin can upload, change, delete and download it, caregiver only is allowed to download it.
*/
//carePlanController.js (four functions handling Supabase-stored care plan files)
//uploadCarePlan, downloadCarePlan, deleteCarePlan, updateCarePlan

//Updatecode: route parameter itself renamed to : clientCode. Requires updating the route definitions too.
//const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");
const Client = require("../models/Client.js");//import Client from "../models/Client.js";
const util = require("../utils/clientFilter.js");
const Auditor = require("../utils/auditHelper.js");
const blob_storage = require("../utils/filestorageHelper.js");
const mongoose = require("mongoose");
const { getStaffProfile } = require("../utils/staffHelper.js");

//=======================Upload Careplan File=====================

//Uploads a new care plam fle for a client.
// If the client already has one on file, Rejects.It can be updated to replace the existing file.
const uploadCarePlan = async (req, res) => {
    try {
        console.log(`=======================Upload Careplan File=====================`);
        //const clientId = req.params.clientId;
        const clientCode = req.params.clientCode;
        const file = req.file;
    
        if (!file) {
            return res.status(400).json({ success: false, message: "There is no file for uploading." });
        }

        const client = await Client.findOne({ clientCode: clientCode });//fixed: added missing const
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                message: `Client ${clientCode} does exist in the database.` });
        }

        //Role-based access check
        const filteredClients = util.filterClients(req.user.role, [client]);
        if (filteredClients.length === 0) {
            return res.status(404).json( {
                success: false, 
                message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).`} );

        }

        //IF a care plan file exists, Reject. (Force explicit use of updateCarePlan)
        if (client.carePlan && client.carePlan.filePath) {
            return res.status(400).json({ 
                success: false,
                message: "Client already has a care plan file. Please delete the existing file before uploading a new one." });
        }

        //Upload the raw file to Supabase, get back storage metadata
        const uploadResult = await blob_storage.uploadFile(file, clientCode);

        //Save the file reference(but not the file itself) onto the client record
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientCode },
            {
                carePlan: {
                    filePath: uploadResult.objectPath,
                    storedFilename: uploadResult.storedFilename,
                    mimeType: uploadResult.mimeType,
                    uploadedAt: new Date()
                }
            },
            { returnDocument: "after", runValidators: true }
        );

        //Display who persormed this action with a fullname and employee code
        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        await Auditor.auditLogger(
            req.user.id,
            'upload_careplan',
            clientCode,
            { carePlan: null },
            { carePlan: updatedClient.carePlan }
        );

        //Console before returning 
        console.log(`--------Care plan file uploaded successfully!--------`);
        console.log(`Client: ${updatedClient.clientCode} (${updatedClient.fullName})`);
        console.log(`Uploaded by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        console.log(`Stored file: ${updatedClient.carePlan.storedFilename} (${updatedClient.carePlan.mimeType})`);

        res.status(200).json({
            success: true,
            message: "Care plan file uploaded successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                clientName: updatedClient.fullName,
                staffEmployeeCode: staffProfile.employeeCode,
                staffName: staffProfile.fullName,
                carePlan: updatedClient.carePlan
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to upload care plan file.",
            error: error.message
        });
    }
};

//===========DownloadCarePlan=================
const downloadCarePlan = async (req, res) => {
    try {

        console.log(`================Start download CarePlan==============`);
        //const clientId = req.params.clientId;
        const clientCode = req.params.clientCode;
        const client = await Client.findOne({ clientCode: clientCode });
        if (!client) {
            return res.status(404).json({
                success: false,
                message: `Client ${clientCode} does not exist in the database.` });
        }

        const filteredClients = util.filterClients(req.user.role, [client]);
            if (filteredClients.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).` });
        }


        if (!client.carePlan || !client.carePlan.filePath) {
            return res.status(404).json({ 
                success: false, 
                message: `No care plan file found for this client $(clientCode).` });
        }

        // Download the file from Supabase
        const fileData = await blob_storage.downloadFile(client.carePlan.filePath);

        const staffProfile = await getStaffProfile(req.user.id, req.user.role);
        console.log(`--------Care plan file downloaded succeddfully!--------`);
        console.log(`Client: ${client.clientCode} (${client.fullName})`);
        console.log(`Downloaded by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        
        // Set the appropriate headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${client.carePlan.storedFilename}"`);
        res.setHeader('Content-Type', client.carePlan.mimeType);

        // Send the file data as a response
        res.send(fileData);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to download care plan file.",
            error: error.message
        });
    }
}

// ==========Delete Careplan File from Supabase and remove reference from Client record==========

const deleteCarePlan = async (req, res) => {
    try {

        console.log(`==========Start to Delete Careplan File from Supabase and remove reference from Client record==========`);
        const clientCode = req.params.clientCode;
        const client = await Client.findOne({ clientCode: clientCode });
        if (!client) {
            return res.status(404).json({ 
                success: false, 
                message: `Client ${clientCode} does not exist in the database.` });
        }

        const filteredClients = util.filterClients(req.user.role, [client]);
        if (filteredClients.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).` });
        }

        if (!client.carePlan || !client.carePlan.filePath) {
            return res.status(404).json({ 
                success: false, 
                message: `No care plan file found for client ${clientCode}.` });
        }

        // Delete the file from Supabase
        await blob_storage.deleteFile(client.carePlan.filePath);

        // Remove the care plan file information from the client record
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientCode },
            { $unset: { carePlan: "" } },
            { returnDocument: "after" }
        );

        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        Auditor.auditLogger(
            req.user.id,
            'delete_careplan',
            clientCode,
            { carePlan: client.carePlan },
            { carePlan: null }
        );

        console.log(`--------Care plan file deleted successfully!--------`);
        console.log(`Client: ${updatedClient.clientCode} (${updatedClient.fullName})`);
        console.log(`Deleted by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);

        res.status(200).json({
            success: true,
            message: "Care plan file deleted successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                clientName: updatedClient.fullName,
                staffEmployeeCode: staffProfile.employeeCode,
                staffName: staffProfile.fullName,
                carePlan: updatedClient.carePlan
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete care plan file.",
            error: error.message
        });
    }
};
//==========================updateCarePlan=====================

// this function uploads a new care plan file for a client, old care plan is retained in the database for audit purposes.
const updateCarePlan = async (req, res) => {
    try {

        console.log(`===============Start to Update care Plan===============`);
        const clientCode = req.params.clientCode;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message:  `No file was uploaded.`});
        }

        const client = await Client.findOne({ clientCode: clientCode });
        if (!client) {
            return res.status(404).json({
                success: false,
                message:  `Client ${clientCode} does not exist in the database.`});
        }

        const filteredClients = util.filterClients(req.user.role, [client]);
        if (filteredClients.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).` });
        }

        if(!client.carePlan || !client.carePlan.filePath) {
            return res.status(400).json({ success: false, message: "No existing care plan file to update." });
        }

        const uploadResult = await blob_storage.uploadFile(file, clientCode);

        // Update the client's carePlanFile field with the new file information
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientCode },
            {
                carePlan: {
                    filePath: uploadResult.objectPath,
                    storedFilename: uploadResult.storedFilename,
                    mimeType: uploadResult.mimeType,
                    uploadedAt: new Date()
                }
            },
            { returnDocument: "after", runValidators: true }
        );

        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        Auditor.auditLogger(
            req.user.id,
            'update_careplan',
            clientCode,
            { carePlan: client.carePlan },
            { carePlan: updatedClient.carePlan }
        );

        console.log(`--------Care plan file updated successfully!--------`);
        console.log(`Client: ${updatedClient.clientCode} (${updatedClient.fullName})`);
        console.log(`Updated by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        console.log(`Old file: ${client.carePlan.storedFilename} -> New file: ${updatedClient.carePlan.storedFilename}`);
        
        res.status(200).json({
            success: true,
            message: "Care plan file updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                clientName: updatedClient.fullName,
                staffEmployeeCode: staffProfile.employeeCode,
                staffName: staffProfile.fullName,
                carePlan: updatedClient.carePlan
            }
        });
    } catch (error) {
        console.error("Error updating care plan:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update care plan file.",
            error: error.message
        });
    }
};

module.exports = {
    uploadCarePlan,
    downloadCarePlan,
    deleteCarePlan,
    updateCarePlan
};