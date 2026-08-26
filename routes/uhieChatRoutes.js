const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { health, chat } = require("../controllers/uhieChatController");

router.get("/health", health);
router.post("/chat", protect, chat);

module.exports = router;
