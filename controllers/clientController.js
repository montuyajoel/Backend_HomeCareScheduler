const geocodeStructuredAddress = require("../utils/geocodeStructuredAddress.js");
const Client = require("../models/Client");//import Client from "../models/Client.js";
const util = require("../utils/clientFilter.js");
const Auditor = require("../utils/auditHelper.js");
const mongoose = require("mongoose");

const { getStaffProfile } = require("../utils/staffHelper.js");
const { getAddressDiff } = require("../utils/diffHelper.js");

const blob_storage = require("../utils/filestorageHelper.js");

const { uploadCarePlan, downloadCarePlan, deleteCarePlan, updateCarePlan }
= require("./carePlanController.js");
const { updateEmergencyContact } = require("./emergencyContactController.js");
const { updateNote } = require("./noteController.js");


//!!!FOR createclient and UpdateClient , only for the address part, not completed!!!!
//const clients = await Client.find().sort({ createdAt: -1 })
//const filteredClients = util.filterClients(req.user.role, clients);
/*const existingClient = await Client.findOne({ clientCode: req.params.clientId }); // raw query result
const filteredClients = util.filterClients(req.user.role, [existingClient]);      // filtered array
const targetClient = filteredClients[0];// the one confirmed target
// */

//============================GET all clients============================
//controller handles business logic
const getAllClients = async (req, res) => {
    try {
        const clients = await Client.find().sort({ createdAt: -1 });//descending order
        //if (clients.length > 0) (
        console.log(`Fetching client details for clientId: ${JSON.stringify(req.user)}`);
        //console.log(`Fetching client details for clientId: ${JSON.stringify(req.user)}`);
        const filteredClients = util.filterClients(req.user.role, clients);
        if (filteredClients.length > 0) {
            res.status(200).json({
                success: true,
                body: filteredClients
            })
        } else {
            res.status(404).json({
                success: false,
                message: 'No clients found in the database.'
            })
        }
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch clients",
            error: error.message,
        });
    }
};

//============================Get Specific Client============================
// req.param must contain clientId or clientCode
//check for null first, return immediately if it's true, and only call filterClients once you've confirmed specific_client exists.
const getSpecificClient = async (req, res) => {
    try {
        const clientId = req.params.clientId
        console.log(`Fetching client details for clientId: ${clientId}, requested by User-: ${JSON.stringify(req.user)}`);
        //const qclient = await Client.findOne({ clientCode: clientId });
        const specific_client = await Client.findOne({ clientCode: clientId });

        //return client is null, return 404 error, else return the client details
        //Check for null first; return immediately if true, skipping the rest
        if (!specific_client) {
            return res.status(404).json({ success: false, message: `Client ${clientId} does not exist in the database.` })
        }

        //filter clients based on user role
        //This line only runs once specific_client is confirmed to exist
        const filteredClients = util.filterClients(req.user.role, [specific_client]);
        if (filteredClients.length > 0) {
            res.status(200).json({ success: true, body: filteredClients[0] })
        } else {
            res.status(404).json({ success: false, message: `Client ${clientId} exists but is not accessible to your role (${req.user.role}).` })
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve client details.',
            error: error.message
        })

    }
}

//============================createClient============================
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

        //otherFields.birthDate = new Date(otherFields.birthDate).toISOString(); // Convert birthDate to a Date object
        //new Date(...).toISOString (without ()) grabs the method itself as a function reference, not its string result.
        //.toISOString() returns the full timestamp format ("1942-07-04T00:00:00.000Z"),
        //current regex /^\d{4}-\d{2}-\d{2}$/ only accepts a bare date"1942-07-04". So the simplest fix is to just delete that conversion line entirely and let the raw "1942-07-04"

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

/*//Helper: compare old and new address, return only the fields that actually changed
function getAddressDiff(oldAddress, newAddress) {
    const fields = ['addressLine', 'town', 'city', 'county', 'postCode', 'latitude', 'longitude'];
    const diff = {};
    fields.forEach(field => {
        if (oldAddress?.[field] !== newAddress?.[field]) {
            diff[field] = {before: oldAddress?.[field] ?? null, after: newAddress?.[field] ?? null };
        }
    });
    return diff;

}*/

//============================updateClientAddress============================-------
const updateClientAddress = async (req, res) => {
    try {
        console.log(`============================Start updateClientAddress Activity============================`);
        //Extract address fields and other fields from request body
        const { addressLine, town, city, county, postCode, ...otherFields } = req.body;

        //Find the existing client
        //const existingClient = await Client.findOne({ clientCode: req.params.clientId });
        const existingClient = await Client.findOne({ clientCode: req.params.clientId });
        if (!existingClient) {
            return res.status(404).json({ success: false, message: `Client ${req.params.clientId} does not exist in the database.` });
        }

        //precondition now guaranteed satisfied: check if the client exists and is accessible based on user role
        //filter the existing client based on user role
        //filteredClients is an array:plural name.
        const filteredClients = util.filterClients(req.user.role, [existingClient]);
        //If client not found, return error
        if (filteredClients.length === 0) {
            return res.status(404).json({ success: false, message: `Client ${req.params.clientId} exists but is not accessible to your role (${req.user.role}).` });
        }

        //get the first element from the filtered array
        const targetClient = filteredClients[0]; 

        //Initialize address update with targetClient's address
        let addressUpdate = targetClient.address;

        //Check if address has changed
        const addressChanged =
            addressLine !== targetClient.address.addressLine ||
            city !== targetClient.address.city ||
            postCode !== targetClient.address.postCode;

        //Update address and re-geocode if needed
        if (addressChanged) {
            const { latitude, longitude } = await geocodeStructuredAddress({ addressLine, town, city, county, postCode });
            addressUpdate = { addressLine, town, city, county, postCode, latitude, longitude };
        } else {
            //If address hasn't changed, keep the existing info.
            console.log(`addressUpdate false! No changes detected in the address fields.`);
            return res.status(400).json({ success: false, message: "No changes detected in the address fields."});
        }
        //Update client with the new address
        const updated = await Client.findOneAndUpdate(
            { clientCode: req.params.clientId },
            { ...otherFields, address: addressUpdate },
            { returnDocument: "after", runValidators: true }
        );

        console.log('Mongoose connection host:', mongoose.connection.host);
        console.log('Mongoose connection db name:', mongoose.connection.name);
        console.log('Updated document _id:', updated._id.toString());
        console.log('Updated document address from DB:', JSON.stringify(updated.address));

        //Compute what actually changed, BEFORE responding
        const addressChanges = getAddressDiff(existingClient.address, updated.address);

    

        //-------Record the addressUpdate into Log, do this BEFORE sending the response----------
        //So the response and terminal can reflect a completed operation
        //await -since auditLogger is an async function, makes the executin order predictable and guarantees the log write completes first.
        await Auditor.auditLogger(
            req.user.id,       //who did it
            'change_address',  //what type of  action
            updated.clientCode, //to which client, using clientCode instead od clientId
            existingClient.address,//the vlalue before changing
            updated.address //the value after changing
        );

        //---------For log and display staff's fullname and employeeCode---------
        //Returns: { employeeCode, fullName } for a valid admin/caregiver user,
        //or null if the role is unrecognized or the linked profile doesn't exist.
        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        //moves the console logging before res.json. Finish everything, then respond
        console.log(`--------Client's address updated and logged successfully!--------`);

        console.log(`Client: ${updated.clientCode} (${updated.fullName}),
            Updated by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        console.log(`Fields changed: ${JSON.stringify(addressChanges, null, 2)}`);
        
        //console.log(`Updated client address for clientCode: ${updated.clientCode}, requested by User-: ${JSON.stringify(req.user)}`);
        //console.log(`Updated client address for clientCode: ${updated.clientCode}, requested by User-: ${req.user.id}`);

        //Single response, with explicit return, nothing runs after this
        return res.status(200).json({
            success: true,
            message: "Client's address updated and logged successfully!",
            data: {
                adminUser: req.user.id,
                actionType: 'change_address',
                client: updated.clientCode,
                clientName: updated.fullName,
                changes: addressChanges,
                oldAddress: existingClient.address,
                newAddress: updated.address
            }
        });

    } catch (error) {
        //Guard: if headers were sent somehow, don't try to send again
        if (res.headersSent) {
            console.error("Headers already sent, cannot send error response", error.message);
            return;
        }
        return res.status(400).json({ 
            success: false, 
            message: "Failed to update client's address.", error: error.message });
    }
};

//============================updateClientStatus============================----
const updateClientStatus = async (req, res) => {
    try {
        console.log(`============================Start updateClientStatus============================`);
        const { status } = req.body;
        const existingClient = await Client.findOne({ clientCode: req.params.clientId });
        if (!existingClient) {
            console.log(`Client ${req.params.clientId} does not exist in the database.`);
            return res.status(404).json({
                success: false,
                message: `Client ${req.params.clientId} does not exist in the database.`
            });
        } else {
            console.log(`Client ${req.params.clientId} found in the database.`);
        }
        const filteredClients = util.filterClients(req.user.role, [existingClient]);//filter based on user role
        if (filteredClients.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Client ${req.params.clientId} exists (current status: "${existingClient.status}"),
                    but is not accessible to your role (${req.user.role}).`
                
            });
        }
        //const targetClient = filteredClients[0]; //get the first element from the filtered array

        //if (status) is an input validation check — "did the request body actually include a status field"
        //confirming the caller intends to perform an update, not that the record already has some status.
        
        if (status) {
            let updated;//declared without a value yet, currently undefined

            //if status is 'inactive' or 'other', require inactiveReason and statusNotes
            if (status === 'inactive' || status === 'other') {
                const { inactiveReason, statusNotes } = req.body;
                //require statusNotes for non-active clients
                if (!statusNotes || !inactiveReason) {
                    return res.status(400).json({ success: false, message: "Status notes and inactive reason are required for non-active clients." });
                }
                // Update the client with inactive details
                updated = await Client.findOneAndUpdate(
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
                    updated = await Client.findOneAndUpdate(
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
                updated = await Client.findOneAndUpdate(
                    { clientCode: req.params.clientId },
                    {
                        $unset: { statusDetails: "" }, //remove statusDetails field for active clients
                        status: status
                    },
                    { returnDocument: "after", runValidators: true }
                );
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: `Client ${req.params.clientId} exists (current status: "${existingClient.status}"). An invalid status value provided.` });
            }
            
            console.log(`--------Client's status updated successfully!--------`);
            console.log(`Updated client status for clientId: ${req.params.clientId}, requested by User-: ${JSON.stringify(req.user)}`);
            console.log(`Updated client status details: ${JSON.stringify(updated)}`);
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
        res.status(400).json({ success: false, message: "Failed to update client's status.", error: error.message });
    }
}

//=======================Delete Client=====================
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

//Upload Careplan File
//uploadCarePlan,
//downloadCarePlan,
 //deleteCarePlan,
//updateCarePlan,
//updateEmergencyContact,
//updateNote

module.exports = {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    getAddressDiff,
    updateClientStatus,
    deleteClient,
    uploadCarePlan,
    downloadCarePlan,
    deleteCarePlan,
    updateCarePlan,
    updateEmergencyContact,
    updateNote
};

