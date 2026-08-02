const mongoose = require('mongoose');

 // Audit log containing type, old note, new note, admin user, date, and time
const AuditLogSchema = new mongoose.Schema({
    actionType: {
        type: String,
        enum: [ 'status_update',
                'change_address', 
                'update_careplan', 
                'delete_client', 
                'delete_careplan', 
                'update_emergency_contact',
                'update_note'],
        required: true,
    },
    oldValue: {
        type: JSON,
        default: null,
    },
    newValue: {
        type: JSON,
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