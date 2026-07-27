const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");
const Client = require("../models/Client");
const util= require("../utils/clientFilter.js");
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

//--------------createClient（only address!!!!!!!未完成）----------------
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
        //Update client with the new address
        const updated = await Client.findOneAndUpdate(
            { clientCode: req.params.clientId },
            { ...otherFields, address: addressUpdate },
            { returnDocument: "after", runValidators: true }
        );
        res.status(200).json({ success: true, message: "Client's address updated successfully.", data: updated });
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
        console.log(`Updating client status for clientId: ${req.params.clientId}, role: ${req.user.role}, existingClient: ${JSON.stringify(existingClient)}`);
        if (!existingClient || existingClient.length === 0) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        existingClient = existingClient[0]; //get the first element of the filtered array

        console.log(`Existing client status: ${existingClient}, New status: ${status}`);
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
            return res.status(400).json({ success: false, message: "No status value was provided." });
        }
    } catch (error) {
        console.error("Error updating client status:", error);
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
module.exports = {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    updateClientStatus,
    deleteClient
};
