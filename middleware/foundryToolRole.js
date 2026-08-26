const Admin = require("../models/Admin");
const Caregiver = require("../models/Caregiver");
const User = require("../models/User");
const {
  sendToolResult,
  getActingRole,
  getActingEmployeeCode,
} = require("../utils/foundryToolHelpers");

async function requireAdminTool(req, res, next) {
  const role = getActingRole(req);
  const employeeCode = getActingEmployeeCode(req);

  if (role !== "admin") {
    return sendToolResult(res, {
      success: false,
      message: "Admin tools require actingRole=admin from signed-in chat context.",
    });
  }

  if (!employeeCode) {
    return sendToolResult(res, {
      success: false,
      message: "actingEmployeeCode is required for admin tools.",
    });
  }

  const admin = await Admin.findOne({ employeeCode });
  if (!admin) {
    return sendToolResult(res, {
      success: false,
      message: `Admin ${employeeCode} not found.`,
    });
  }

  const user = await User.findOne({ adminId: admin._id, isEmailVerified: true });
  if (!user) {
    return sendToolResult(res, {
      success: false,
      message: "Admin account is not registered or verified.",
    });
  }

  req.user = {
    id: user._id,
    role: "admin",
    employeeCode: admin.employeeCode,
    fullName: admin.fullName,
  };
  return next();
}

async function requireCaregiverTool(req, res, next) {
  const role = getActingRole(req);
  const employeeCode = getActingEmployeeCode(req);

  if (role !== "caregiver") {
    return sendToolResult(res, {
      success: false,
      message: "Caregiver tools require actingRole=caregiver from signed-in chat context.",
    });
  }

  if (!employeeCode) {
    return sendToolResult(res, {
      success: false,
      message: "actingEmployeeCode is required for caregiver tools.",
    });
  }

  const pathCode = req.params.employeeCode;
  if (pathCode && pathCode !== employeeCode) {
    return sendToolResult(res, {
      success: false,
      message: "Caregivers may only access their own employeeCode.",
    });
  }

  const caregiverDoc = await Caregiver.findOne({ employeeCode });
  if (!caregiverDoc) {
    return sendToolResult(res, {
      success: false,
      message: `Caregiver ${employeeCode} not found.`,
    });
  }

  req.user = {
    role: "caregiver",
    employeeCode: caregiverDoc.employeeCode,
    fullName: caregiverDoc.fullName,
  };
  return next();
}

module.exports = { requireAdminTool, requireCaregiverTool };
