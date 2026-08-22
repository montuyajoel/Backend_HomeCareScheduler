//utils/staffHelper.js
/**The User model only stores authentication data (email, role, password-related fields) and a foreign key reference (adminId or caregiverId).
It does NOT store the staff's name or employee code. Profile details (employeeCode, fullName) live in separate Admin / Caregiver collections.
As a result, req.user (attached by authMiddleware.js from the decoded JWT) only contains { id, role, iat, exp }, never a readable name or code.
Any controller just can log or display "who performed this action" with ID + role pair instead of the actual staff profile first.*/

/*This helper centralizes that resolution logic in one place so controllers (eg. clientController.js) don't each duplicate the
two-step lookup (User -> adminId/caregiverId -> Admin/Caregiver) or risk drifting out of sync if the linking logic ever changes.*/

//const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Caregiver = require("../models/Caregiver");


async function getStaffProfile(userId, role) {
    const user = await User.findById(userId);
    if (!user) {
        return null;

    }
    if (role === 'admin') {
        return await Admin.findById(user.adminId).select('employeeCode fullName');
    } else if (role === 'caregiver') {
        return await Caregiver.findById(user.caregiverId).select('employeeCode fullName');
    }
    return null;
}

module.exports = { getStaffProfile } ;

// 调用方式一致，不管是 admin 还是 caregiver
//const staffProfile = await getStaffProfile(req.user.id, req.user.role);
//console.log(`Client: ${updated.clientCode} (${updated.fullName}), updated by: ${staffProfile.employeeCode} - ${staffProfile.fullName}`);