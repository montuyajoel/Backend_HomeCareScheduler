//controllers/noteController.js
//====================================================================
//route parameter itself renamed to :clientCode
//Requires updating the route definition, e.g.:
//  router.put("/notes/:clientCode", updateNote)
//====================================================================

const Client = require("../models/Client");
const util = require("../utils/clientFilter.js");
const Auditor = require("../utils/auditHelper.js");
const { getStaffProfile } = require("../utils/staffHelper.js");

//-----------------updateNote----------------------------
const updateNote = async (req, res) => {
    try {
        const clientCode = req.params.clientCode; //renamed: route param is now :clientCode
        const { notes } = req.body;

        if (!notes) {
            return res.status(400).json({ success: false, message: "No note content provided." });
        }

        const existingClient = await Client.findOne({ clientCode: clientCode });
        if (!existingClient) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} does not exist in the database.` });
        }

        const filteredClients = util.filterClients(req.user.role, [existingClient]);
        if (filteredClients.length === 0) {
            return res.status(404).json({ success: false, message: `Client ${clientCode} exists but is not accessible to your role (${req.user.role}).` });
        }

        const updatedClient = await Client.findOneAndUpdate(
            { clientCode: clientCode },
            { notes: notes },
            { returnDocument: "after", runValidators: true }
        );

        if (!updatedClient) {
            return res.status(500).json({ success: false, message: `Failed to update note for client ${clientCode}.` });
        }

        const staffProfile = await getStaffProfile(req.user.id, req.user.role);

        await Auditor.auditLogger(
            req.user.id,
            'update_note',
            clientCode,
            { notes: existingClient.notes },
            { notes: updatedClient.notes }
        );

        console.log(`--------Note updated successfully!--------`);
        console.log(`Client: ${updatedClient.clientCode} (${updatedClient.fullName})`);
        console.log(`Updated by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);
        console.log(`Note before: "${existingClient.notes}"`);
        console.log(`Note after: "${updatedClient.notes}"`);

        return res.status(200).json({
            success: true,
            message: "Note updated successfully.",
            data: {
                clientCode: updatedClient.clientCode,
                clientName: updatedClient.fullName,
                staffEmployeeCode: staffProfile.employeeCode,
                staffName: staffProfile.fullName,
                noteBefore: existingClient.notes,
                noteAfter: updatedClient.notes
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update note.",
            error: error.message
        });
    }
};

module.exports = { updateNote };