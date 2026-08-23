const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const maintenanceBillSchema = new Schema({

  societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  flatNumber: String,

  month: String, // "March 2026"

  amount: Number,

  dueDate: Date,

  status: {
    type: String,
    enum: ["pending", "paid"],
    default: "pending"
  },

  paidAt: Date,

  paymentId: {
  type: Schema.Types.ObjectId,
  ref: "Payment",
  default: null
}

}, { timestamps: true });

//Without this, re-running bill generation for a month silently
//double-bills every resident. The unique index makes generation
//idempotent: a repeat insert fails with a duplicate-key error the
//service can treat as "already generated".
maintenanceBillSchema.index(
  { societyId: 1, userId: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("MaintenanceBill", maintenanceBillSchema);