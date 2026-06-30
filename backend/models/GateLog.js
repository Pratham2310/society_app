const mongoose = require("mongoose");

const gateLogSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },

    guestPassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GuestPass",
      default: null,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      default: null,
    },

    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    visitorType: {
      type: String,
      enum: [
        "guest",
        "delivery",
        "staff",
        "resident",
        "emergency",
        "unknown",
      ],
      required: true,
    },

    visitorName: {
      type: String,
      required: true,
    },

    visitorPhone: {
      type: String,
      default: null,
    },

    vehicleNumber: {
      type: String,
      default: null,
    },

    purpose: {
      type: String,
      default: null,
    },

    scanType: {
      type: String,
      enum: ["entry", "exit"],
      required: true,
    },

    scanTime: {
      type: Date,
      default: Date.now,
    },

    verifiedByQR: {
      type: Boolean,
      default: true,
    },

    device: {
      type: String,
      default: "Main Gate",
    },

    remarks: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GateLog", gateLogSchema);