const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: String,

  eventDate: {
    type: Date,
    required: true
  },

  time: String, // "10:30 AM"

  location: String,

  coverImage: String, // URL

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  // 🔥 HOST INFO (for UI)
  hostName: String,

  // 🔥 INVITED MEMBERS
  invitedMembers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  // 🔥 RSVP (future)
  acceptedMembers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  status: {
    type: String,
    enum: ["upcoming", "completed", "cancelled"],
    default: "upcoming"
  }

}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);