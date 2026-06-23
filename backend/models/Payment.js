const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    maintenanceBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceBill",
      default: null
    },

    contributionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contribution",
      default: null
    },

    amount: {
      type: Number,
      required: true
    },

    paymentType: {
      type: String,
      enum: ["maintenance", "community_fund"],
      required: true
    },

    paymentMethod: {
      type: String,
      enum: [
        "cash",
        "upi",
        "bank_transfer",
        "cheque",
        "online"
      ],
      required: true
    },

    transactionId: String,

    referenceNumber: String,

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending"
    },

    notes: String,

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);