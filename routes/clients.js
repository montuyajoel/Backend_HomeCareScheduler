//separate original clients.js into routes and controllers for a cleaner structure.
//--------Protected route: only logged in admin users can get all clients---------------
const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");
const fileUploadMiddleware = require("../middleware/fileUploadMiddleware");
const {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    updateClientStatus,
    deleteClient,
    uploadCarePlan,
    downloadCarePlan,
    deleteCarePlan,
    updateCarePlan,
    updateEmergencyContact,
    updateNote
} = require("../controllers/clientController");

//route only define endpoint+middleware, only logged in admin users can get all clients
router.get("/", protect, adminOnly, getAllClients);
router.get("/:clientId", protect, getSpecificClient);
router.post("/", protect, adminOnly, createClient);
router.put("/address/:clientId", protect, adminOnly, updateClientAddress);
router.put("/status/:clientId", protect, adminOnly, updateClientStatus);
router.delete("/:clientId", protect, adminOnly, deleteClient);
router.post("/care-plan/:clientId", protect, adminOnly, fileUploadMiddleware.single("file"), uploadCarePlan);
router.get("/care-plan/:clientId", protect, downloadCarePlan);
router.delete("/care-plan/:clientId", protect, adminOnly, deleteCarePlan);
router.put("/care-plan/:clientId", protect, adminOnly, fileUploadMiddleware.single("file"), updateCarePlan);
router.put("/emergency-contact/:clientId", protect, adminOnly, updateEmergencyContact);
router.put("/note/:clientId", protect, adminOnly, updateNote);

module.exports = router;
