/*Mount the route module only
This is the cleaner entry file: load dependencies, connect database,
register middleware, mount routes, then start the server.*/
require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Caregiver = require("./models/Caregiver");
const authRoutes = require("./routes/auth");
const clientRoutes = require("./routes/clients");
const caregiverRoutes = require("./routes/caregivers");

const visitLogRoutes = require("./routes/visitLogs");

const app = express();

//Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body. Make sure the payload is valid JSON with double-quoted property names."
    });
  }
  next(err);
});

// Request logger (logs incoming requests and response status/duration)
const requestLogger = require("./middleware/logger");
app.use(requestLogger);

app.use("/api/visits", visitLogRoutes);

//Connect to MongoDB (local for now, switch to Atlas later)
mongoose
  .connect(process.env.MONGO_URI) //"mongodb://localhost:27017/homeCare"
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

//Health check route
app.get("/", (req, res) => {
  res.send("<h1>HomeCare Scheduler API</h1><p>Status: Online</p>");
});

//API routes
app.use("/api/auth", authRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/clients", clientRoutes);

//------------HSE Data Import (placeholder)----------
app.post("/api/hse-import", (req, res) => {
  res.json({ success: true, message: "HSE import endpoint ready" });
});

//Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
