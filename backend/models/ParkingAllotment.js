const mongoose = require("mongoose");

const parkingAllotmentSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true
    },

    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingSlot",
      required: true
    },

    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      required: true
    },

    vehicleNumber: {
      type: String,
      required: true,
      
    },

    vehicleType: {
      type: String,
      enum: ["car", "bike"],
      required: true
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true //  important for call owner feature
    },

    //  VERY IMPORTANT (history support)
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/*
Prevent same parking slot being assigned twice (active only)
*/
parkingAllotmentSchema.index(
  { slotId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

/*
Fast vehicle search
*/
parkingAllotmentSchema.index({ vehicleNumber: 1 });

module.exports = mongoose.model("ParkingAllotment", parkingAllotmentSchema);