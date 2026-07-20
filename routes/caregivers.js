// route definitions
const express = require("express");
const router = express.Router();

const { createCaregiver, getAllCaregivers, getByCareGiverID, updateCaregiver, deleteCaregiver } = require("../controllers/caregiverController");

//route only defines endpoint
router.post("/", createCaregiver);
router.get("/", getAllCaregivers);
router.get("/:caregiverId", getByCareGiverID);
router.put("/:caregiverId", updateCaregiver);
router.delete("/:caregiverId", deleteCaregiver);

module.exports = router;