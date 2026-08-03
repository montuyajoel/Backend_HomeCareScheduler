
const mongoose = require('mongoose');

// Leave request schema for caregivers
const leaveRequestSchema = new mongoose.Schema({
  employeeCode: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    default: null
  },
  leaveType: {
    type: String,
    enum: ['sick', 'vacation', 'emergency'],
    default: 'vacation',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
    reason: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  }
  ,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  adminNotes: {
    type: String,
    default: ''
  }
},
  { timestamps: true }
);

module.exports = mongoose.model('LeaveRequests', leaveRequestSchema);