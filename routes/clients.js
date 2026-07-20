//separate original clients.js into routes and controllers for a cleaner structure.
//--------Protected route: only logged in admin users can get all clients---------------
const express = require("express");
const router = express.Router();

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { getAllClients, getSpecificClient } = require("../controllers/clientController");

//route only define endpoint+middleware, only logged in admin users can get all clients
router.get("/", protect, adminOnly, getAllClients);
router.get("/:clientId", protect, adminOnly, getSpecificClient )

module.exports = router;
