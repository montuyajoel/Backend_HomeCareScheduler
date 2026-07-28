
const AuditLog = require("../models/AuditLog");
const auditLogger = async (user, actionType, clientCode, oldValues, newValues) => {
    try {
        const auditLogEntry = new AuditLog({
            actionType,
            clientCode: clientCode,
            adminUser: user,
            oldValue: oldValues,
            newValue: newValues,
        });
        await auditLogEntry.save();
    } catch (error) {
        console.error("Error logging audit entry:", error);
    }
}

module.exports = { auditLogger };