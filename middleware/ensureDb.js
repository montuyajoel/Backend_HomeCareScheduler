const connectDB = require("../utils/connectDB");

async function ensureDb(req, res, next) {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("Database connection error:", error.message);
        res.status(503).json({
            success: false,
            message: "Database unavailable. Check MONGO_URI and Atlas network access.",
        });
    }
}

module.exports = ensureDb;
