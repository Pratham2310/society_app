const mongoose = require("mongoose");

const securityAlertSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  visitorRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VisitorRequest"
  },

  type: {
    type: String,
    enum: [
      "fraud",
      "emergency",
      "security_warning"
    ],
    required: true
  },

  message: String,

  status: {
    type: String,
    enum: [
      "active",
      "resolved"
    ],
    default: "active"
  }

}, { timestamps: true });

module.exports = mongoose.model(
  "SecurityAlert",
  securityAlertSchema
);