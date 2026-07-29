const mongoose = require("mongoose"); //import Mongoose, connects JavaScript to MongoDB

//-------------Sub-schema: emergency contact-------
const emergencyContactSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, },

    relationship: { type: String, required: true, trim: true, },

    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^\+?[0-9]{7,15}$/.test(v);
            },
            message: "Invalid phone number",
        },
    },
},
    { _id: false }); //sub docs don't need their own id

//-------------Sub-schema: deceased details-------
const deceasedDetailsSchema = new mongoose.Schema({
    dateOfDeath: { type: Date, required: true },
    causeOfDeath: { type: String, required: true, trim: true },
    timeOfDeath: { type: String, trim: true, required: true, default: "Unknown" }
},
    { _id: false }); //sub docs don't need their own id

//
const statusDetailsSchema = new mongoose.Schema({
        inactiveReason: {
        type: String,
        enum: ["hospitalised", "temporary-service-paused", 'termination-of-service', "family-request", "other", "None"],
        default: "None"
    },
    statusNotes: {
        type: String,
        default: "None"
    },
    deceasedDetails: deceasedDetailsSchema
},
    { _id: false }); //sub docs don't need their own id


const CarePlanSchema = new mongoose.Schema({
    filePath: { type: String, required: true },
    storedFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
},
    { _id: false }); //sub docs don't need their own id 


//--------------main Schema: the full client record---------------
const ClientSchema = new mongoose.Schema({
    clientCode: {
        type: String,
        required: [true, "Client code is mandatory"], //verification1: must fill up
        unique: true, //verification2: unique client code
        trim: true, //auto removes spaces
    },
    fullName: {
        type: String,
        required: [true, "Full name is mandatory"],
        trim: true,
    },
    gender: {
        type: String,
        enum: ["Female", "Male", "Other"],
        required: true,
    },
    age: {
        type: Number,
        required: true,
        min: [0, "Age cannot be negative"],
        max: [120, "Age cannot exceed 120"],
        //Mongoose validates before saving, no need to check manually in routes
    },
    birthDate: {
    type: String,
    required: [true, "Birth date is required"],
    validate: {
        validator(value) {
        return (
            typeof value === "string" &&
            !Number.isNaN(Date.parse(value)) &&
            value === new Date(value).toISOString()
        );
        },
        message: "Birth date must be a valid ISO 8601 date",
    },
    },
    preferredCaregiverGender: {
        type: String,
        enum: ["Female", "Male", "Other", "No Preference"],
        default: "No Preference",
    },
    mobilityStatus: {
        type: String,
        enum: ["Independent", "Assisted", "Hoisted", "Wheelchair-bound", "Bedridden", "Other"],
        default: "Independent",
    },
    cognitiveStatus: {
        type: String,
        enum: ["Normal", "Mild Cognitive Impairment", "Dementia", "Other"],
        default: "Normal",
    },
    address: {
        addressLine: { type: String, required: true },
        town: { type: String },
        city: { type: String, required: true },
        county: { type: String },
        postCode: { type: String, required: true },
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^\+?[0-9]{7,15}$/.test(v);
            },
            message: "Invalid phone number",
        },
    },
    hasPets: {
        type: Boolean,
        default: false,
    }, //for matching with caregiver pet allergy
    careNeeds: [String], //array of strings, one client can have multiple care needs
    emergencyContact: emergencyContactSchema,
    notes: {
        type: String,
        trim: true,
        default: "",
    },
    status: {
        type: String,
        enum: ["active", "inactive", "deceased", "other"],
        default: "active",
    },
    statusDetails: statusDetailsSchema,
    carePlan: CarePlanSchema, //embedded sub-document for care plan file info
    },
    { timestamps: true }, //create and modify time automatically, createdAt & updatedAt
);


module.exports = mongoose.model("Client", ClientSchema);

/*My implementation focuses on Modular Architecture and Data Integrity.
I have defined Mongoose Schemas with built-in validation for business-critical fields like clientCode and phoneNumber.
I am using structured schema design to keep the code clean, scalable, and ready for future scheduling features.
*/