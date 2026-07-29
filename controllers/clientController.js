const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");
const Client = require("../models/Client");
const util= require("../utils/clientFilter.js");
const Auditor = require("../utils/auditHelper.js");
const blob_storage = require("../utils/filestorageHelper.js");
//!!!FOR createclient and UpdateClient , only for the address part, not completed!!!!

//--------GET all clients---------------
//controller handles business logic
const getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });//descending order
        //filter clients based on user role
        const filteredClients = util.filterClients(req.user.role, clients);
        if (filteredClients.length > 0) (
            res.status(200).json({
                success: true,
                body: filteredClients
            })
        )
        else (
            res.status(404).json({
                success: false,
                message: 'No clients found in the database.'
            })
        )
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch clients",
            error: error.message,
        });
    }
};

//----------Get Specific Client------------------
// req.param must contain clientId or clientCode
const getSpecificClient = async (req, res) => {
    try {
        clientId = req.params.clientId
        const specific_client = await Client.findOne({ clientCode: clientId });
        //filter clients based on user role
        filteredClients = util.filterClients(req.user.role, [specific_client]);
        if (filteredClients.length > 0) {
            res.status(200).json({ success: true, body: filteredClients[0] });
        } else {
            res.status(404).json({ success: false, message: `Client ${clientId} not found.` });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve client details.',
            error: error.message
        })

    }
}

//--------------createClient----------------
const createClient = async (req, res) => {
    try {
        const { address, ...otherFields } = req.body;
        const { latitude, longitude } = await geocodeStructuredAddress({
            addressLine: address.addressLine,
            town: address.town,
            city: address.city,
            county: address.county,
            postCode: address.postCode
        });
        otherFields.birthDate = new Date(otherFields.birthDate).toISOString();// Convert birthDate to Date object

        const newClient = new Client({
            ...otherFields,
            address: {
                addressLine: address.addressLine,
                town: address.town,
                city: address.city,
                county: address.county,
                postCode: address.postCode,
                latitude, longitude
            }
        }
        );
        const saved = await newClient.save();
        res.status(201).json({ success: true, message: 'Client record created successfully', data: saved });
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to create a new client record", error: error.message });
    }
};

//-----------------updateClient(only address!!!!!!!未完成)----------------------------
const updateClientAddress = async (req, res) => {
    try {
        //Extract address fields and other fields from request body
        const { addressLine, town, city, county, postCode, ...otherFields } = req.body;

        //Find the existing client
        existingClient = await Client.findOne({ clientCode: req.params.clientId });

        existingClient = util.filterClients(req.user.role, [existingClient]); //filter based on user role
        //If client not found, return error
        if (!existingClient || existingClient.length === 0) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        existingClient = existingClient[0]; //get the first element of the filtered array
        //Initialize address update with existing address
        let addressUpdate = existingClient.address;

        //Check if address has changed
        const addressChanged =
            addressLine !== existingClient.address.addressLine ||
            city !== existingClient.address.city ||
            postCode !== existingClient.address.postCode;

        //Update address and re-geocode if needed
        if (addressChanged) {
            const { latitude, longitude } = await geocodeStructuredAddress({ addressLine, town, city, county, postCode });
            addressUpdate = { addressLine, town, city, county, postCode, latitude, longitude };
        }
        else {
            return res.status(400).json({ success: false, message: "No changes detected in the address fields." });
        }
        //Update client with the new address
        const updated = await Client.findOneAndUpdate(
            { clientCode: req.params.clientId },
            { ...otherFields, address: addressUpdate },
            { returnDocument: "after", runValidators: true }
        );

        //Log the address update action
        Auditor.auditLogger(req.user.id, 
            'change_address', 
            req.params.clientId,
            existingClient.address, 
            updated.address);

        res.status(200).json({ 
            success: true, 
            message: "Client's address updated successfully.", 
            data: {
                adminUser: req.user.id,
                actionType: 'change_address',
                client: updated.clientCode,
                clientName: updated.fullName,
                oldAddress: existingClient.address,
                newAddress: updated.address
        } 
    });
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to update client's address.", error: error.message });
    }
};

//------------------------updateClientStatus--------------------------
const updateClientStatus = async (req, res) => {
    try {
        const { status } = req.body;
        existingClient = await Client.findOne({ clientCode: req.params.clientId });

        existingClient = util.filterClients(req.user.role, [existingClient]); //filter based on user role

        if (!existingClient || existingClient.length === 0) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        existingClient = existingClient[0]; //get the first element of the filtered array

        if (status) {
            if (status === existingClient.status) {
                return res.status(400).json({ success: false, message: "The provided status is the same as the current status. No changes made." });
            }

            // if status is 'inactive' or 'other', require inactiveReason and statusNotes
            if (status === 'inactive' || status === 'other') {
                const { inactiveReason, statusNotes } = req.body;
                //require statusNotes for non-active clients
                if (!statusNotes || !inactiveReason) {
                    return res.status(400).json({ success: false, message: "Status notes and inactive reason are required for non-active clients." });
                }
                // Update the client with inactive details
                const updated = await Client.findOneAndUpdate(
                    { clientCode: req.params.clientId },
                    {
                        status: status,
                        statusDetails: {
                            inactiveReason: inactiveReason,
                            statusNotes: statusNotes
                        }
                    },
                    { returnDocument: "after", runValidators: true }
                );

            }
            // if status is 'deceased', require dateOfDeath and causeOfDeath
            else if (status === 'deceased') {
                const { dateOfDeath, causeOfDeath, timeOfDeath } = req.body;
                //require dateOfDeath and causeOfDeath for deceased clients
                if (!dateOfDeath || !causeOfDeath || !timeOfDeath) {
                    return res.status(400).json({ success: false, message: "Date of death, time of death, and cause of death are required for deceased clients." });
                }
                    // Update the client with deceased details
                    const updated = await Client.findOneAndUpdate(
                        { clientCode: req.params.clientId },
                        {
                            status: status,
                            statusDetails: {
                                deceasedDetails:{
                                dateOfDeath: dateOfDeath,
                                causeOfDeath: causeOfDeath || "Unknown",
                                timeOfDeath: timeOfDeath
                                }
                            }
                        },
                        { returnDocument: "after", runValidators: true }
                    );
                } 
             else if (status === 'active') {
                //if status is 'active', remove statusDetails entirely
                const updated = await Client.findOneAndUpdate(
                    { clientCode: req.params.clientId },
                    {
                        $unset: { statusDetails: "" }, //remove statusDetails field for active clients
                        status: status
                    },
                    { returnDocument: "after", runValidators: true }
                );
            }
            else {
                return res.status(400).json({ success: false, message: "Invalid status value provided." });
            }
            
            // Check if changes were made to the client record
            const updated = await Client.findOne({ clientCode: req.params.clientId });
           
            // Log the status update action
            Auditor.auditLogger(
                req.user.id,
                'status_update',
                req.params.clientId,
                {
                    status: existingClient.status,
                    statusDetails: existingClient.statusDetails
                },
                {
                    status: updated.status,
                    statusDetails: updated.statusDetails
                }
            );

            // Return the updated client information
            return res.status(200).json({ 
                    success: true, data: {
                        clientCode: updated.clientCode,
                        fullName: updated.fullName,
                        status: updated.status,
                        statusDetails: updated.statusDetails
                    } 
                });
        }
        else {
            // If no status value is provided in the request body, return an error
            return res.status(400).json({ success: false, message: "No status value was provided." });
        }
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to update client's status.", error: error.message });
    }
}

//-----Delete Client
const deleteClient = async (req, res) => {
    try {
        const clientCode = req.params.clientId;
        const client = await Client.findOneAndDelete({ clientCode: clientCode });
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        res.status(200).json({ success: true, message: "Client " + clientCode + " has been removed from the database." });
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to remove client.", error: error.message });
    }
}


// Careplan File Upload
const uploadCarePlan = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const file = req.file;
    
        if (!file) {
            return res.status(400).json({ success: false, message: "No file was uploaded." });
        }

        client = await Client.findOne({ clientCode: clientId });
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        
        // Check if the client already has a care plan file
        if (client.carePlan && client.carePlan.filePath) {
            return res.status(400).json({ success: false, message: "Client already has a care plan file. Please delete the existing file before uploading a new one." });
        }

        // Upload the file to Supabase
        const uploadResult = await blob_storage.uploadFile(file, clientId);

        // Update the client's carePlanFile field with the new file information
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientId },
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

        res.status(200).json({
            success: true,
            message: "Care plan file uploaded successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                carePlanFile: updatedClient.carePlanFile
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


const downloadCarePlan = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const client = await Client.findOne({ clientCode: clientId });
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        if (!client.carePlan || !client.carePlan.filePath) {
            return res.status(404).json({ success: false, message: "No care plan file found for this client." });
        }

        // Download the file from Supabase
        const fileData = await blob_storage.downloadFile(client.carePlan.filePath);

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

// Delete Careplan File from Supabase and remove reference from Client record
const deleteCarePlan = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const client = await Client.findOne({ clientCode: clientId });
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        if (!client.carePlan || !client.carePlan.filePath) {
            return res.status(404).json({ success: false, message: "No care plan file found for this client." });
        }

        // Delete the file from Supabase
        await blob_storage.deleteFile(client.carePlan.filePath);

        // Remove the care plan file information from the client record
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientId },
            { $unset: { carePlan: "" } },
            { returnDocument: "after" }
        );

        Auditor.auditLogger(
            req.user.id,
            'delete_careplan',
            clientId,
            { carePlan: client.carePlan },
            { carePlan: null }
        );

        res.status(200).json({
            success: true,
            message: "Care plan file deleted successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                carePlanFile: updatedClient.carePlan
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

//-----------------updateCarePlan--------------------------
// this function uploads a new care plan file for a client, old care plan is retained in the database for audit purposes.
const updateCarePlan = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "No file was uploaded." });
        }

        const client = await Client.findOne({ clientCode: clientId });
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        if(!client.carePlan || !client.carePlan.filePath) {
            return res.status(400).json({ success: false, message: "No existing care plan file to update." });
        }

        const uploadResult = await blob_storage.uploadFile(file, clientId);

        // Update the client's carePlanFile field with the new file information
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientId },
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

        Auditor.auditLogger(
            req.user.id,
            'update_careplan',
            clientId,
            { carePlan: client.carePlan },
            { carePlan: updatedClient.carePlan }
        );
        
        res.status(200).json({
            success: true,
            message: "Care plan file updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                carePlanFile: updatedClient.carePlan
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

//-----------------updateEmergencyContact--------------------------
// this function updates the emergency contact information for a client using clientCode
const updateEmergencyContact = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const { name, phoneNumber, relationship } = req.body;
        const ECUpdate = { name, phoneNumber, relationship };

       const existingClient = await Client.findOne({ clientCode: clientId });

        // Check if the client was found
        if (!existingClient) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        if(existingClient.emergencyContact.name === ECUpdate.name 
            && existingClient.emergencyContact.phoneNumber === ECUpdate.phoneNumber) {
            return res.status(400).json({ success: false, message: "The provided emergency contact information is the same as the current information. No changes made." });
        }

        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientId },
            { emergencyContact: ECUpdate },
            { returnDocument: "after", runValidators: true }
        );
        
        // Check if the update was successful
        if (!updatedClient) {
            return res.status(500).json({ success: false, message: "Failed to update emergency contact information." });
        }

        // Log the emergency contact update action
        Auditor.auditLogger(
            req.user.id,
            'update_emergency_contact',
            clientId,
            { emergencyContact: existingClient.emergencyContact },
            { emergencyContact: ECUpdate }
        );

        // Update the client's emergency contact information
        res.status(200).json({
            success: true,
            message: "Emergency contact updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                emergencyContact: updatedClient.emergencyContact
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update emergency contact.",
            error: error.message
        });
    }
}


const updateNote = async (req, res) => {
    try {
        const clientId = req.params.clientId;
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({ success: false, message: "No note content provided." });
        }

        const existingClient = await Client.findOne({ clientCode: clientId });

        // Check if the client was found
        if (!existingClient) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        // Update the client's note
        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientId },
            { notes: notes },
            { returnDocument: "after", runValidators: true }
        );

        // Check if the update was successful
        if (!updatedClient) {
            return res.status(500).json({ success: false, message: "Failed to update note." });
        }

        // Log the note update action
        Auditor.auditLogger(
            req.user.id,
            'update_note',
            clientId,
            { notes: existingClient.notes },
            { notes: notes }
        );

        res.status(200).json({
            success: true,
            message: "Note updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                note: updatedClient.note
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update note.",
            error: error.message
        });
    }
}

module.exports = {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    updateClientStatus,
    deleteClient,
    uploadCarePlan,
    downloadCarePlan,
    deleteCarePlan,
    updateCarePlan,
    updateEmergencyContact,
    updateNote
};
