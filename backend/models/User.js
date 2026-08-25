const mongoose = require("mongoose");
const {
  SYSTEM_ROLES,
  SOCIETY_ROLES,
  SYSTEM_ROLE_VALUES,
  SOCIETY_ROLE_VALUES,
} = require("../utils/roles");
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
    select: false,
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

  //Enums come from utils/roles.js so the schema can never drift
  //from what the middleware and routes enforce.
  systemRole:{
    type:String,
    enum:SYSTEM_ROLE_VALUES,
    default:SYSTEM_ROLES.USER
  },
  societyRole:{
    type:String,
    enum:SOCIETY_ROLE_VALUES,
    default:SOCIETY_ROLES.MEMBER
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

  //Uploaded profile photo. A URL, not the image — uploads go to
  //Cloudinary and only the reference is kept here.
  avatar: {
    type: String,
    default: null
  },

  //OTP is stored as a bcrypt hash, never in plain text.
  otpHash: { type: String, select: false },
  otpExpires: Date,
  otpAttempts: { type: Number, default: 0, select: false },
  otpLastSentAt: { type: Date, select: false },
  isOtpVerified:{
    type:Boolean,
    default:false
  },

  //Bumping this invalidates every token issued before the change.
  tokenVersion: { type: Number, default: 0 },

  //Expo push tokens, one per device. A resident may have a phone and a
  //tablet; a guard may share a device across shifts, so the same token
  //can move between users and must be released when it does.
  pushTokens: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ["ios", "android"] },
    deviceId: { type: String },
    updatedAt: { type: Date, default: Date.now },
    _id: false,
  }],
  //Browser push, for the web build. Separate from pushTokens because
  //a Web Push subscription is a URL plus two keys, not an Expo token,
  //and the two are delivered by different services entirely.
  webPushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: String,
      auth: String,
    },
    updatedAt: { type: Date, default: Date.now },
    _id: false,
  }],

  staffCategory:{
    type:String,
    enum:["maid", "cook", "milkman"]
  },
  entryTime:{
    type:String
  }

}, { timestamps: true });

//Second line of defence: even an explicit .select("+password")
//must not leak through res.json().
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.otpHash;
    delete ret.otpAttempts;
    delete ret.otpLastSentAt;
    delete ret.__v;
    return ret;
  },
});

//Expire OTP material automatically.
userSchema.index(
  { otpExpires: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { otpHash: { $exists: true } } }
);

module.exports = mongoose.model("User", userSchema);