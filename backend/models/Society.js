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

    // Where residents actually send maintenance and contributions. The
    // committee sets this, and the app shows it verbatim on the pay
    // screens — so it is never derived or defaulted, only displayed.
    payment: {
      upiId: { type: String, trim: true, default: "" },
      payeeName: { type: String, trim: true, default: "" },
      bankName: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      ifsc: { type: String, trim: true, uppercase: true, default: "" },
      notes: { type: String, trim: true, default: "" },
    },

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