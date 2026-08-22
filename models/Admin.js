const mongoose = require("mongoose");
const AdminSchema = new mongoose.Schema(
    {
        employeeCode: {
            type: String,
            required: [true, "EmployeeCode is required"],
            unique: true,
            trim: true,
        },
        fullName:{
            type: String,
            required: [true, "Full name is required"],
            trim: true,
        },

        gender: {
            type: String, enum: ["Male","Female","Other"],required: true,
        },
        age: {
            type: Number,
            required: true,
            min: [18, "Admin must be at least 18 years old"],
            max: [65, "Age cannot exceed 65"],     
        },
        phoneNumber:{ 
            type: String, 
            required: true, 
            trim:true,  
            validate: {
                validator: function(v) {
                return /^\+?[0-9]{7,15}$/.test(v);
            },
            message: 'Invalid phone number',
            },
        },
        email: {
            type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true,
        }, //Automatically converts to lowercase to avoid duplicate entries
    },
    { timestamps: true,
      collection: 'admin'
    }, //specify collection name to avoid pluralization
    //automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model("Admin", AdminSchema);
//Register as Admin model,mongoDB creates aan admin collection automatically