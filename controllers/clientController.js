const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");

const Client = require("../models/Client");
//!!!FOR createclient and UpdateClient , only for the address part, not completed!!!!

//--------GET all clients---------------
//controller handles business logic
const getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });//descending order
        if (clients.length>0)(
            res.status(200).json({
                status:'success',
                body:clients
            })
        )
        else(
            res.status(404).json({
                status: 'success',
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
    try{
        clientId = req.params.clientId
        const qclient = await Client.findOne({clientCode:clientId});
            if (qclient)(
                res.status(200).json({status:'success', body:qclient})
            )
            else(
                res.status(404).json({status:'failed', message: `Client ${clientId} not found.'`})
            )
    }catch(error){
        res.status(500).json({
            status:'failed',
            message:'Failed to retrieve client details.',
            error: error.message
        })

    }
}

//--------------createClient（only address!!!!!!!未完成）----------------
const createClient = async (req, res) => {
    try {
        const { addressLine, town, city, county, postCode, ...otherFields } = req.body;

        const { latitude, longitude } = await geocodeStructuredAddress({ addressLine, town, city, county, postCode });

        const newClient = new Client({...otherFields,
            address: { addressLine, town, city, county, postCode, latitude, longitude },
        });

        const saved = await newClient.save();
        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to create a new client record" });
    }
};

//-----------------updateClient(only address!!!!!!!未完成)----------------------------

const updateClient = async (req, res) => {
    try {
        const { addressLine, town, city, county, postCode, ...otherFields } = req.body;

        const existingClient = await Client.findById(req.params.id);
        if (!existingClient) {
            return res.status(404).json({ success: false, message: "Client not found." });
        }

        let addressUpdate = existingClient.address;

        const addressChanged =
            addressLine !== existingClient.address.addressLine ||
            city !== existingClient.address.city ||
            postCode !== existingClient.address.postCode;

        if (addressChanged) {
            const { latitude, longitude } = await geocodeStructuredAddress({ addressLine, town, city, county, postCode });
            addressUpdate = { addressLine, town, city, county, postCode, latitude, longitude };
        }

        const updated = await Client.findByIdAndUpdate(
        req.params.id,
        { ...otherFields, address: addressUpdate },
        { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(400).json({ success: false, message: "Failed to update client's information. " });
    }
};

module.exports = {getAllClients, getSpecificClient, createClient, updateClient};
