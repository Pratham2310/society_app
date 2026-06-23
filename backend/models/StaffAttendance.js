const mongoose = require("mongoose");

const staffAttendanceSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StaffProfile",
    required: true
  },

  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  entryTime: Date,

  exitTime: Date,

  status: {
    type: String,
    enum: [
      "present",
      "leave",
      "absent"
    ],
    default: "present"
  }

}, { timestamps: true });

module.exports = mongoose.model(
  "StaffAttendance",
  staffAttendanceSchema
);