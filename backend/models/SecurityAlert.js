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
      "acknowledged",
      "resolved"
    ],
    default: "active"
  },

  //A guard seeing an alert and a guard having dealt with it are
  //different things. Whoever raised it wants to know somebody is on
  //the way before it is closed out.
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  acknowledgedAt: Date,
  resolvedAt: Date

}, { timestamps: true });

module.exports = mongoose.model(
  "SecurityAlert",
  securityAlertSchema
);