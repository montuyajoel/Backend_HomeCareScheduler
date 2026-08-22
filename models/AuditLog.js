const mongoose = require('mongoose');
//replacing the handcoded array.
const { AUDIT_ACTION_TYPES } = require('../constants/auditActionTypes.js');
// Audit log containing type, old note, new note, admin user, date, and time

const AuditLogSchema = new mongoose.Schema({
    actionType: {
        type: String,
        //enum: [ 'status_update', 'change_address', 'update_careplan', 'delete_client', 'delete_careplan', 'update_emergency_contact', 'update_note' ],
        enum: AUDIT_ACTION_TYPES,
        required: true,
    },
    oldValue: {
        //type: JSON,
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    newValue: {
        //type: JSON,
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    clientCode: {
        type: String,
        required: true,
    },
    adminUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser',
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    time: {
        type: String,
        default: function() {
            return new Date().toLocaleTimeString();
        }
    }
});

module.exports = mongoose.model('AuditLogs', AuditLogSchema);