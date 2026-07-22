// route definitions
const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { createCaregiver, getAllCaregivers, getByCareGiverID, updateCaregiver, deleteCaregiver, computeTravel } = require("../controllers/caregiverController.js");

//route only defines endpoint
router.post("/", protect, adminOnly, createCaregiver);
router.get("/", protect, adminOnly, getAllCaregivers);
router.get("/:caregiverId", protect, getByCareGiverID);
router.put("/:caregiverId", protect, adminOnly, updateCaregiver);
router.delete("/:caregiverId", protect, adminOnly, deleteCaregiver);
router.post('/travel', protect, computeTravel)

module.exports = router;