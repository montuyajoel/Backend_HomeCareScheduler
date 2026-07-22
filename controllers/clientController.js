const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");
const Client = require("../models/Client");
//!!!FOR createclient and UpdateClient , only for the address part, not completed!!!!

//--------GET all clients---------------
//controller handles business logic
const getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });//descending order
        if (clients.length > 0) (
            res.status(200).json({
                success: true,
                body: clients
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
        const qclient = await Client.findOne({ clientCode: clientId });
        if (qclient) (
            res.status(200).json({ success: true, body: qclient })
        )
        else (
            res.status(404).json({ success: false, message: `Client ${clientId} not found.'` })
        )
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
        const existingClient = await Client.findOne({ clientCode: req.params.clientId });

        //If client not found, return error
        if (!existingClient) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

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
            { new: true, runValidators: true }
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
        const existingClient = await Client.findOne({ clientCode: req.params.clientId });
        if (!existingClient) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }
        if (status) {
            const updated = await Client.findOneAndUpdate(
                { clientCode: req.params.clientId },
                { status: status },
                { new: true, runValidators: true }
            );
            return res.status(200).json({ success: true, data: updated });
        } else {
            return res.status(400).json({ success: false, message: "No status value was provided in the request body." });
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
module.exports = {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    updateClientStatus,
    deleteClient
};
