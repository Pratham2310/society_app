const mongoose = require("mongoose");

const staffAssignmentSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StaffProfile",
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  },

  startedAt: {
    type: Date,
    default: Date.now
  },

  endedAt: Date

}, { timestamps: true });

module.exports = mongoose.model(
  "StaffAssignment",
  staffAssignmentSchema
);