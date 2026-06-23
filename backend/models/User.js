const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({

  name: {
    type: String,
    trim: true
  },

  email: {
    type: String,
    unique: true,
    index: true,
    lowercase: true
  },

  password: {
    type: String,

  },

  phone: {
    type: String,
    required: true
  },

  // 🔥 SYSTEM ROLE (DO NOT CONFUSE WITH OWNER/TENANT)
  // role: {
  //   type: String,
  //   enum: [
  //     "superadmin",
  //     "salesperson",
  //     "chairman",
  //     "secretary",
  //     "treasurer",
  //     "committee_member",
  //     "member",
  //     "security"
  //   ],
  //   default: "member"
  // },

  systemRole:{
    type:String,
    enum:[
      "superadmin",
      "salesperson",
      "user"
    ],
    default:"user"
  },
  societyRole:{
    type:String,
    enum:[
      "chairman",
      "secretary",
      "treasurer",
      "commitee_member",
      "member",
      "security"

    ],
    default:"member"
  },

  isOnboarded:{
    type:Boolean,
    default:false
  },
  // 🔥 NEW: OWNER / TENANT
  occupancyType: {
    type: String,
    enum: ["owner", "tenant"]
  },

  // 🔥 FIXED: Living status
  livingType: {
    type: String,
    enum: ["family", "bachelor", "commercial"]
  },

  // 🔥 Only for family
  familySize: Number,

  // 🔥 Multiple vehicles supported
  vehicles: [
    {
      type: {
        type: String,
        enum: ["car", "bike"]
      },
      number: String,
      parkingSlot: String
    }
  ],

  agreedToTerms: {
    type: Boolean,
    default: false
  },

  consentAlerts: {
    type: Boolean,
    default: false
  },

  societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    default: null
  },

  wingId: {
    type: Schema.Types.ObjectId,
    ref: "Wing",
    default: null
  },

  flatId: {
    type: Schema.Types.ObjectId,
    ref: "Flat",
    default: null
  },
  flatNumber:{
    type:String
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  otp: String,
  otpExpires: Date,
  isOtpVerified:{
    type:Boolean,
    default:false
  },
  staffCategory:{
    type:String,
    enum:["maid", "cook", "milkman"]
  },
  entryTime:{
    type:String
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);