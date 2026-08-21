//VisitLog Schema-for recoring clock in/ out data for each caregiver visit
const mongoose = require("mongoose");

const VisitLogSchema = new mongoose.Schema(
    {
        //Before a VisitLog can reference it, a schedule must exists first
        schedule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Schedule",
            required: true,
        },
        caregiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Caregiver",
            required: true,
        },
        client: { //for easier querying of all visit per client
            type: mongoose.Schema.Types.ObjectId,
            ref: "Client",
            required: true,
        },
        clockIn: {
            time: { type: Date },
            location: {
                latitude: { type: Number, required: true },
                longitude: { type: Number, required: true },
            },
        },
        clockOut: {
            time: { type: Date },
            location: {
                latitude: { type: Number },
                longitude: { type: Number },
            },
        },

        durationMinutes: { type: Number },  //calculate it automatically after clock out 
        status: {
            type: String,
            enum: ["in-progress", "completed"],
            default: "in-progress",
        },

        //Location failer (>200m)is a hard rejection, no VisitLog is created
        //is Exception is only set due to "more than 20 mins late"

        isException: { type: Boolean, default: false },
        exceptionType: { type: [String], default: [],}, // now only contains late-clockin

        note: { type: String },
        reviewRequired: {
            type: Boolean,
            enum: [false, true],
            default: false,
        },
        //if reviewRequired is true, then reviewStatus is set to "pending" by default, and can be updated to "approved" or "rejected" by admin
        reviewStatus: {
            type: String,
            enum: ["pending-review", "not-required", "approved", "rejected"],
            default: "not-required",
        }
    },
    
    { timestamps: true }
);

module.exports = mongoose.model("VisitLog", VisitLogSchema);