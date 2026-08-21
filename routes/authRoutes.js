//routes/auth.js
//only defines route paths, actual logic stores in authController.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
    sendRegisterCode,
    verifyRegisterCode,
    login,
    sendRecoveryCode,
    verifyRecoveryCode,
    getMe,
} = require ("../controllers/authController");

router.post("/register/send-code", sendRegisterCode);
router.post("/register/verify", verifyRegisterCode);
router.post("/login", login);
router.post("/recover/send-code", sendRecoveryCode);
router.post("/recover/verify", verifyRecoveryCode,);

router.get("/me", protect, getMe);

module.exports = router;

