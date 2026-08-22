//constants/auditActionTypes.js
//Single source of truth for all valid audit log action types.
//Referenced by AuditLog.js's schema enum, and can also be reused to validate an actionType before logging.
//Add a new action type here ONCE.

const { modelName } = require("../models/User");

const AUDIT_ACTION_TYPES = [
            'status_update',
            'change_address',
            'upload_careplan',
            'update_careplan',
            'delete_client',
            'delete_careplan',
            'update_emergency_contact',
            'update_note',
            'schedule_update'
        
];

modelName.exports = { AUDIT_ACTION_TYPES };