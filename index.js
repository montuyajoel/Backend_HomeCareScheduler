/*Mount the route module only
This is the cleaner entry file: load dependencies, connect database,
register middleware, mount routes, then start the server.*/

require("dotenv").config();
require("./utils/irelandTime");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const clientRoutes = require("./routes/clientRoutes");
const caregiverRoutes = require("./routes/caregiverRoutes");
const supaBase = require("./utils/filestorageHelper");
const scheduleRoutes = require("./routes/scheduleRoutes");
const leaveRequestRoutes = require("./routes/leaveRequestRoutes");
const visitLogRoutes = require("./routes/visitLogRoutes");
const uhieChatRoutes = require("./routes/uhieChatRoutes");
const {
  checkUhieConnection,
} = require("./services/uhieFoundryService");
const ensureDb = require("./middleware/ensureDb");
const connectDB = require("./utils/connectDB");

const app = express();

//Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body. Make sure the payload is valid JSON with double-quoted property names.",
    });
  }
  next(err);
});

// Request logger (logs incoming requests and response status/duration)
const requestLogger = require("./middleware/logger");
app.use(requestLogger);

//Health check route (no DB required)
app.get("/", (req, res) => {
  res.send("<h1>HomeCare Scheduler API</h1><p>Status: Online</p>");
});

// DB health check — use after deploy to confirm Atlas is reachable from Vercel
app.get("/api/health/db", ensureDb, (req, res) => {
  res.json({
    success: true,
    message: "MongoDB connected",
    readyState: require("mongoose").connection.readyState,
  });
});

// Uhie chat (Foundry) — health does not need DB; mount before ensureDb
app.use("/api/uhie", uhieChatRoutes);

// All API routes require a live MongoDB connection (important on Vercel serverless)
app.use("/api", ensureDb);

app.use("/api/visits", visitLogRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/visit-logs", visitLogRoutes);

//------------HSE Data Import (placeholder)----------
app.post("/api/hse-import", (req, res) => {
  res.json({ success: true, message: "HSE import endpoint ready" });
});

// Supabase probe: local dev only. Uhie probe: local + Vercel cold start (non-blocking).
if (!process.env.VERCEL) {
  supaBase.checkSupabaseConnection();
}
checkUhieConnection();


// Local dev: start listening server
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
      process.exit(1);
    });
}

module.exports = app;
