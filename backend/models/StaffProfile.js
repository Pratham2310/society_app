const mongoose = require("mongoose");

const staffProfileSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  name: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: [
      "maid",
      "cook",
      "driver",
      "laundry",
      "milk_delivery",
      "gardener",
      "cleaner",
      "security",
      "other"
    ],
    required: true
  },

  photo: String,

  govtId: String,

  verificationStatus: {
    type: String,
    enum: [
      "pending",
      "approved",
      "rejected",
      "blocked"
    ],
    default: "pending"
  },

  //A guard signs in to the app; a maid does not. Set when the staff
  //member was given a login, so removing the profile can end the
  //account with it.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  //Household staff belong to the resident who employs them. Society
  //staff — guards, gardeners — belong to nobody and this stays null.
  employedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  //When they are expected each day, shown on the gate list.
  entryTime: String,

  idProofType: String,
  idProofNumber: String,
  address: String,

  //Household staff get a gate pass once the secretary approves them,
  //valid for a run of days rather than a single visit.
  passCode: {
    type: String,
    default: null,
    index: true
  },
  qr: {
    type: String,
    default: null
  },
  passExpiresAt: Date,

  isActive: {
    type: Boolean,
    default: true
  },

  blockedReason: String

}, { timestamps: true });

module.exports = mongoose.model(
  "StaffProfile",
  staffProfileSchema
);