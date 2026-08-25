const mongoose = require("mongoose");

// =======================================================
// AMENITY BOOKING
//
// One resident holding one amenity for one stretch of one day.
//
// Times are stored twice on purpose: as the "HH:MM" strings the app
// displays, and as minutes past midnight. Overlap has to be compared
// numerically, and comparing "09:00" against "10:30" as strings only
// works by accident of zero-padding — one unpadded value written by
// anything else and two bookings would silently share the hall.
// =======================================================

const bookingSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  amenityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Amenity",
    required: true,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  //"YYYY-MM-DD". A calendar day, not an instant — a booking for the
  //14th is for the 14th wherever the phone happens to be.
  date: {
    type: String,
    required: true,
  },

  startTime: { type: String, required: true },
  endTime: { type: String, required: true },

  startMinutes: { type: Number, required: true },
  endMinutes: { type: Number, required: true },

  purpose: {
    type: String,
    trim: true,
    maxlength: 300,
    default: "",
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "rejected", "cancelled"],
    default: "confirmed",
    index: true,
  },

  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  decidedAt: Date,

  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 300,
    default: null,
  },

}, { timestamps: true });

// The day view, and the overlap check that guards every new booking.
bookingSchema.index({ amenityId: 1, date: 1, status: 1, startMinutes: 1 });

// The committee's approval queue.
bookingSchema.index({ societyId: 1, status: 1, date: 1 });

module.exports = mongoose.model("AmenityBooking", bookingSchema);
