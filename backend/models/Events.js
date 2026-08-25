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

  //The app shows a social get-together differently from a society
  //notice-board event, and asks for a contribution only where there is
  //a fee to pay.
  eventType: {
    type: String,
    enum: ["Society", "Social"],
    default: "Society"
  },

  fee: {
    type: Number,
    default: 0,
    min: 0
  },

  //Who has actually paid, separate from who said they would come.
  //Attending and having paid are different questions, and the event
  //screen shows both counts.
  paidMembers: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      amount: Number,
      paidAt: { type: Date, default: Date.now },
      _id: false
    }
  ],

  status: {
    type: String,
    enum: ["upcoming", "completed", "cancelled"],
    default: "upcoming"
  }

}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);