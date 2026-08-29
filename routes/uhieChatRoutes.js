const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const ensureDb = require("../middleware/ensureDb");
const { health, chat } = require("../controllers/uhieChatController");

// Public liveness — no DB / JWT
router.get("/health", health);

// Chat needs JWT + DB (staff profile for Foundry context)
router.post("/chat", ensureDb, protect, chat);

module.exports = router;
