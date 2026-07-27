//separate original clients.js into routes and controllers for a cleaner structure.
//--------Protected route: only logged in admin users can get all clients---------------
const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
    getAllClients,
    getSpecificClient,
    createClient,
    updateClientAddress,
    updateClientStatus,
    deleteClient
} = require("../controllers/clientController");

//route only define endpoint+middleware, only logged in admin users can get all clients
router.get("/", protect, adminOnly, getAllClients);
router.get("/:clientId", protect, getSpecificClient);
router.post("/", protect, adminOnly, createClient);
router.put("/address/:clientId", protect, adminOnly, updateClientAddress);
router.put("/status/:clientId", protect, adminOnly, updateClientStatus);
router.delete("/:clientId", protect, adminOnly, deleteClient);

module.exports = router;
