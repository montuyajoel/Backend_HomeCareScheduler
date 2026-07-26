// controllers/authController.js
// Holds all auth-related business logic, no route definitions here

//jsonwebtoken creates and verifies JWT tokens
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Caregiver = require("../models/Caregiver");
const Admin = require("../models/Admin");

//helper function, defines in utils/sendEmail.js
const { sendEmail } = require("../utils/sendEmail");

//---------helper:generate a random 6-digit code-----
//Math.random() * 900000 gives a number 0..899999,
//+ 100000 ensures it's always 6digit 100000..999999
const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

//-----------helper: generate JWT token--------------
const generateToken = (userId, role) => {
    return jwt.sign(
        { id: userId, role },//payload: the data stored inside the token
        process.env.JWT_SECRET,
        { expiresIn: "7d" } //valid for 7days,user stays logged in for a week
    );
};

//═════════════════════════STEP 1 OF REGISTRATION═════════════════════════
//POST /api/auth/register/send-code
//User submits fullName + employeeCode + email + role
//System verifies the record, then sends a verification code to email
const sendRegisterCode = async (req, res) => {
    try {
        const { fullName, employeeCode, email, role } = req.body;

        const existingUser = await User.findOne({ email });
        //check1 if this email already registered
        if (existingUser && existingUser.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: "This email is already registered.",
            });
        }

        //check2 if the employeeCode + fullName match a profile
        let profile = null;
        if (role === "caregiver") {
            profile = await Caregiver.findOne({ employeeCode, fullName });
        } else if (role === "admin") {
            profile = await Admin.findOne({ employeeCode, fullName });
        } else {
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        if (!profile) {
            return res.status(400).json({
                success: false,
                message: "Employee code or name does not match our records.",
            });
        }

        //check3 if this employeeCode already linked to another account
        const alreadyLinked = role === "caregiver"
            ? await User.findOne({ caregiverId: profile._id, isEmailVerified: true })
            : await User.findOne({ adminId: profile._id, isEmailVerified: true });

        if (alreadyLinked) {
            return res.status(400).json({
                success: false,
                message: "This employee code is already registered.",
            });
        }

        //---generate verification code-----
        const code = generateCode();
        //current time + 5 minutes (in milliseconds)
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        //--------save or update a pending User document-------
        //use findOneAndUpdate with upsert:true so that if the user
        //requests a new code, we just update the existing pending record
        await User.findOneAndUpdate(
            { email },
            {
                email,
                role,
                caregiverId: role === "caregiver" ? profile._id : null,
                adminId: role === "admin" ? profile._id : null,
                isEmailVerified: false,
                emailVerificationCode: code,
                emailVerificationExpiry: expiry,
            },
            { upsert: true, returnDocument: "after" }
        );
        //------------send verification code by email-------
        await sendEmail({
            to: email,
            subject: "HomeCare Scheduler — Email Verification Code",
            text: `Your verification code is: ${code}\n\nThis code expires in 60 seconds.\n\nDo not share this code with others.`,
        });
        res.status(200).json({
            success: true,
            message: "Verification code sent to your email. Please enter it to complete registration.",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

//═════════════════════════STEP 2 OF REGISTRATION═════════════════════════
//POST /api/auth/register/verify
//User submits email + the 6-digit code from their inbox， on success, registration is complete
const verifyRegisterCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({ email, isEmailVerified: false });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "No pending registration found for this email.",
            });
        }
        //Check 1 Has the code expired
        if (new Date() > user.emailVerificationExpiry) {
            return res.status(400).json({
                success: false,
                message: "Verification code has expired. Please request a new one.",
            });
        }
        //Check 2 Does the code match
        if (user.emailVerificationCode !== code) {
            return res.status(400).json({
                success: false,
                message: "Incorrect verification code.",
            });
        }
        //Mark email as verified and clear the code
        user.isEmailVerified = true;
        user.emailVerificationCode = null;
        user.emailVerificationExpiry = null;
        await user.save();

        res.json({ success: true, message: "Registration complete! You can now log in.", });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

//══════════════════════Normal login: fullName + employeeCode + role═════════════════════════════
//POST /api/auth/login
//No password,employeeCode IS the credential
const login = async (req, res) => {
    try {
        const { fullName, employeeCode, role } = req.body;
        //Step 1 find the profile matching fullName + employeeCode
        let profile = null;

        if (role === "caregiver") {
            profile = await Caregiver.findOne({ employeeCode, fullName });
        } else if (role === "admin") {
            profile = await Admin.findOne({ employeeCode, fullName });
        }

        if (!profile) {
            return res.status(401).json({
                success: false,
                message: "Invalid name or employee code.",
            });
        }
        //Step 2 find the verified User account linked to this profile
        const query = role === "caregiver"
            ? { caregiverId: profile._id, isEmailVerified: true }
            : { adminId: profile._id, isEmailVerified: true };

        const user = await User.findOne(query);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "No registered account found. Please register first.",
            });
        }
        //Step 3 Issue JWT token
        const token = generateToken(user._id, role);

        res.json({
            success: true,
            token,
            role,
            message: "Login successful.",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ══════════════════STEP 1 of Account Recovery══════════════════════════════
//POST /api/auth/recover/send-code
//User submits their registered email
//System sends a one-time recovery code to that email
const sendRecoveryCode = async (req, res) => {
    try {
        const { email } = req.body;
        //find the registered account for this email
        const user = await User.findOne({ email, isEmailVerified: true });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No registered account found with this email.",
            });
        }
        //generate recovery code and set 5mins expiry
        const code = generateCode();
        user.recoverCode = code;
        //5 * 60 * 1000 = 300,000 milliseconds = 5mins
        user.recoverCodeExpiry = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        await sendEmail({
            to: email,
            subject: "HomeCare Scheduler — Account Recovery Code",
            text: `Your account recovery code is: ${code}\n\nThis code expires in 1 hour.\n\nDo not share this code with others.`,
        });

        res.json({
            success: true,
            message: "Recovery code sent to your email.",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ═════════════════════STEP 2 of ACCOUNT RECOVERY══════════════════════════════════
//POST /api/auth/recover/verify
//User submits email + recovery code
//On success, system logs them in and they can view their employeeCode
const verifyRecoveryCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        const user = await User.findOne({ email, isEmailVerified: true });
        if (!user || !user.recoverCode) {
            return res.status(400).json({
                success: false,
                message: "No recovery request found. Please request a code first.",
            });
        }
        //check expiry
        if (new Date() > user.recoverCodeExpiry) {
            return res.status(400).json({
                success: false,
                message: "Recovery code has expired. Please request a new one.",
            });
        }
        //check code match
        if (user.recoverCode !== code) {
            return res.status(401).json({
                success: false,
                message: "Incorrect recovery code.",
            });
        }
        //Invalidate the recovery code immediately after use
        user.recoverCode = null;
        user.recoverCodeExpiry = null;
        await user.save();

        //Issue a JWT so the user is logged in
        const token = generateToken(user._id, user.role);

        //fetch the profile to return the real employeeCode
        let profile = null;
        if (user.role === "caregiver") {
            profile = await Caregiver.findById(user.caregiverId).select("employeeCode fullName");
            //.select("employeeCode fullName") returns only these two fields, not the whole document
        } else {
            //Return the real employeeCode so the user can see it on the recovery success page
            profile = await Admin.findById(user.adminId).select("employeeCode fullName");
        }

        res.json({
            success: true,
            token,
            role: user.role,
            employeeCode: profile.employeeCode,
            message: "Identity verified. Your employee code has been retrieved.",
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

//══════════════════════Get current logged-in user═════════════════════════
const getMe = async (req, res) => {
    // req.user is attached by authMiddleware; this just returns it
    res.json({ success: true, user: req.user });
};

//══════════════════════Health Check Endpoint═════════════════════════
const healthCheck = (req, res) => {
    res.json({ success: true, message: "Backend service is running." });
}

module.exports = {
    sendRegisterCode,
    verifyRegisterCode,
    login,
    sendRecoveryCode,
    verifyRecoveryCode,
    getMe,
    healthCheck
};