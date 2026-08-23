const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const societySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    pincode: Number,

    hasWingStructure: {
      type: Boolean,
      default: false
    },

    totalWings: {
      type: Number,
      default: 0
    },

    //Six digits, enforced at the schema so nothing can write a
    //non-numeric code by another path.
    societyCode: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{6}$/, "Society code must be 6 digits"]
    },

    status: {
      type: String,
      enum: ["under_construction", "active", "handed_over"],
      default: "active"
    },

    subscriptionPlan: String,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// ✅ Better unique constraint
societySchema.index({ name: 1, address: 1 }, { unique: true });

module.exports = mongoose.model("Society", societySchema);