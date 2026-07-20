//Schema/model
/*My implementation focuses on Modular Architecture and Data Integrity.
I have defined  Mongoose Schemas with built-in validation for business-critical fields like petAllergy and employeeCode. I am using Express Routers to maintain a clean and scalable codebase,
ensuring the system can handle future feature expansions easily.
*/
const mongoose = require("mongoose"); //import Mongoose, connects JavaScript to MongoDB

//------Sub-schema:availability-------
const availabilitySchema = new mongoose.Schema({
  day:{
    type:String,
    enum:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
    required:true,
  },

  startTime:{
    type:String,
    required:true    //e.g. "08:00" stored as text, not Date object
  },
  endTime:{
    type:String,
    required:true
  },
},
{ id: false }); //sub documents don't need their own id

//--------main Schema: the full caregiver record---------------
const CaregiverSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    }, //each caregiver profile is associated with a user login account. After login, first get req.user._id
    //Then find the corresponding caregiver profile: Caregiver.findOne({user: req.user._id})
    //returns the actual caregiver.id.  Using caregiver._id to query the Schedule.
    
    
    employeeCode: {
      type: String,
      required: [true, "Employee code is mandatory"], //if not provided, MongoDB will return error message//verification1: must to fill up
      unique: true, //unique employee code, verification2:全局唯一 no 2 caregivers can share the same code
      trim: true, //auto removes spaces
      //uppercase：true
    },
    fullName: {
      type: String,
      required: [true,"Full name is mandatory"],
      trim:true,
    },

    gender:{
      type:String,
      enum:["Female","Male","Other",],
      required:true,
    },

    age:{
      type:Number,
      required:true,
      min:[18,"Caregiver must be at least 18 years old"],
      max:[65,"Age cannot exceed 65"],
      //MOngoose validates before saving, no need to check manually in routes
    },
    //locationCode: { type: String, required: true, trim:true,},

    address: {
      addressLine: { type: String, required: true },
      town: { type: String },
      city: { type: String, required: true },
      county: { type: String },
      postCode: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
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
    hasPetAllergy: { type: Boolean, default: false }, //if not provided when creating a caregiver, defaults to false
    skills: [String], // array of strings, one caregiver can have multiple skills:"Dementia Care", "Palliative Care"
    availability: [availabilitySchema],
    status: {
      type: String,
      enum: ["active", "on-leave"], // deleted "retired" staff, not kept
      default: "active",
    },
  },
  { timestamps: true }, //create and modify time automatically, createdAt & updatedAt
);

module.exports = mongoose.model("Caregiver", CaregiverSchema);

