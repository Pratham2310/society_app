const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true
    },

    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wing",
      default: null
    },

    slotNumber: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["resident", "visitor"],
      required: true
    },

    //  Derived but stored for fast UI
    status: {
      type: String,
      enum: ["free", "occupied", "reserved"],
      default: "free"
    },

    //  Current live vehicle in slot
    currentVehicleNumber: {
      type: String,
      default: null
    },

    //  Useful for tracking updates / future realtime
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

/*
Ensure slot numbers are unique inside a society
*/
parkingSlotSchema.index(
  { societyId: 1, slotNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);