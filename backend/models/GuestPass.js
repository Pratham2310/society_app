const mongoose = require("mongoose");

const guestPassSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      required: true,
    },

    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wing",
      required: true,
    },

    guestName: {
      type: String,
      required: true,
      trim: true,
    },

    guestPhone: {
      type: String,
      required: true,
      trim: true,
    },

    guestPhoto: {
      type: String,
      default: null,
    },

    purpose: {
      type: String,
      enum: [
        "family",
        "friend",
        "delivery",
        "maintenance",
        "business",
        "other",
      ],
      default: "other",
    },

    vehicleNumber: {
      type: String,
      default: null,
    },

    numberOfGuests: {
      type: Number,
      default: 1,
      min: 1,
    },

    arrivalDate: {
      type: Date,
      required: true,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    passType: {
      type: String,
      enum: ["one_time", "multi_day", "permanent"],
      default: "one_time",
    },

    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    qrCode: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "active",
        "suspended",
        "cancelled",
        "expired",
      ],
      default: "active",
    },

    lastScannedAt: {
      type: Date,
      default: null,
    },

    extendedCount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GuestPass", guestPassSchema);