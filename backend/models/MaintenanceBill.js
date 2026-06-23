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

module.exports = mongoose.model("MaintenanceBill", maintenanceBillSchema);