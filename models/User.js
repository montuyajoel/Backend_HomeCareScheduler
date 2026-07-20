const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");//bcryptjs handles password hashing

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"], //used for registration and account recovery
            unique: true,
            lowercase: true,
            trim: true,
        },
        
        //Controls what the user can access throughout the system
        role: {
            type: String,
            enum: ["admin","caregiver"],
            required: true,
            default:"caregiver",
        },

        //link to Caregiver record
        caregiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Caregiver",// this objectId points to a document in the Caregiver collection
            default: null,
        },
        //link to Admin record
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default:null,
        },

        //Email verification
        isEmailVerified: {
            type: Boolean,
            default: false, //false=registration not yet complete; true=email confirmed
        },
        emailVerificationCode: {
            type: String,
            default: null, //6 digit code sent to email
        },
        emailVerificationExpiry:{
            type: Date,
            default: null,
        },//code expires after 60s

        //One-time code for account recovery
        recoverCode: {type: String, default: null,},//generated randomly,sent by email,valid foe 5mins,invalidated after use
        recoverCodeExpiry: {type: Date, default: null,}, //recovery code expires after 5mins
    },
    { timestamps: true}
);

module.exports = mongoose.model("User", UserSchema);