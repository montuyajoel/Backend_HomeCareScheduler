//controllers/emergencyContactController.js
//====================================================================
//route parameter itself renamed to :clientCode
//Requires updating the route definition, e.g.:
//  router.put("/emergency-contact/:clientCode", updateEmergencyContact)
//====================================================================

const Client = require("../models/Client");
const util = require("../utils/clientFilter.js");
const Auditor = require("../utils/auditHelper.js");
const { getStaffProfile } = require("../utils/staffHelper.js");
const { getFieldDiff } = require("../utils/diffHelper.js");

//-----------------updateEmergencyContact----------------------------
const updateEmergencyContact = async (req, res) => {
    try {
        const clientCode = req.params.clientCode; //renamed: route param is now :clientCode
        const { name, phoneNumber, relationship } = req.body;
        const ECUpdate = { name, phoneNumber, relationship };

        const existingClient = await Client.findOne({ clientCode: clientCode });
        if (!existingClient) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} does not exist in the database.` });
        }

        const filteredClients = util.filterClients(req.user.role, [existingClient]);
        if (filteredClients.length === 0) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).` });
        }

        if (existingClient.emergencyContact.name === ECUpdate.name
            && existingClient.emergencyContact.phoneNumber === ECUpdate.phoneNumber) {
            return res.status(400).json({ success: false, message: `Client ${clientCode}: provided emergency contact information is the same as the current information. No changes made.` });
        }

        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientCode },
            { emergencyContact: ECUpdate },
            { returnDocument: "after", runValidators: true }
        );

        if (!updatedClient) {
            return res.status(500).json({ success: false, message: `Failed to update emergency contact information for client ${clientCode}.` });
        }

        const contactChanges = getFieldDiff(
            existingClient.emergencyContact,
            updatedClient.emergencyContact,
            ['name', 'phoneNumber', 'relationship']
        );

        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        await Auditor.auditLogger(
            req.user.id,
            'update_emergency_contact',
            clientCode,
            { emergencyContact: existingClient.emergencyContact },
            { emergencyContact: updatedClient.emergencyContact }
        );

        console.log(`--------Emergency contact updated successfully!--------`);
        console.log(`Client: ${updatedClient.clientCode} (${updatedClient.fullName})`);
        console.log(`Updated by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        console.log(`Fields changed: ${JSON.stringify(contactChanges, null, 2)}`);

        return res.status(200).json({
            success: true,
            message: "Emergency contact updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                clientName: updatedClient.fullName,
                staffEmployeeCode: staffProfile.employeeCode,
                staffName: staffProfile.fullName,
                changes: contactChanges,
                emergencyContact: updatedClient.emergencyContact
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update emergency contact.",
            error: error.message
        });
    }
};

module.exports = { updateEmergencyContact };