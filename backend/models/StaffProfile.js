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

  blockedReason: String

}, { timestamps: true });

module.exports = mongoose.model(
  "StaffProfile",
  staffProfileSchema
);