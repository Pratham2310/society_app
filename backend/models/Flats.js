const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const flatSchema = new Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true
    },

    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wing",
      default: null
    },

    flatNumber: {
      type: String,
      required: true
    },

    floor: {
      type: Number,
      required: true
    },

    isOccupied: {
      type: Boolean,
      default: false
    },

    parkingSlot: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// ✅ Unique flat per wing/society
flatSchema.index(
  { societyId: 1, wingId: 1, flatNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Flat", flatSchema);