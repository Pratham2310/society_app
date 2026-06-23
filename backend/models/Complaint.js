const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const complaintSchema = new Schema({

  societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  userId: { //  keep your naming (no need to change)
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  flatNumber: String, //  NEW (UI)

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: String,

  //  NEW (UI categories)
  category: {
    type: String,
    enum: ["plumbing", "electrical", "security", "general"],
    required: true
  },

  //  UPDATED STATUS (UI based)
  status: {
    type: String,
    enum: ["pending", "reviewed", "in_progress", "resolved"],
    default: "pending"
  },

  //  URGENT TAG
  isUrgent: {
    type: Boolean,
    default: false
  },

  //  IMAGE SUPPORT
  image: String,

  //  TICKET ID
  ticketId: {
    type: String,
    unique: true
  },

  // 1 TIMELINE (MAIN FEATURE)
  timeline: [
    {
      status: String,
      message: String,
      updatedBy: String,
      time: { type: Date, default: Date.now }
    }
  ],

  resolvedAt: Date

}, { timestamps: true });

module.exports = mongoose.model("Complaint", complaintSchema);