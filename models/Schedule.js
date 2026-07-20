//Schedule Schema, the planned shift
const mongoose = require("mongoose");

const ScheduleSchema = new mongoose.Schema(
    {
        caregiver: { type: mongoose.Schema.Types.ObjectId, ref: "Caregiver", required: true,},
        client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true,},
        date: {type: Date, required: true, }, //Shift date, only for checking "is this today"
        startTime: { type: String, required: true, }, //format "HH:MM:SS"
        endTime: { type: String, required: true, },
        status: { type: String, enum: ["scheduled", "in-progress", "completed", "cancelled"], default: "scheduled",},
        notes: { type: String },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", },
    },

    { timestamps: true }
);

module.exports = mongoose.model("Schedule", ScheduleSchema);