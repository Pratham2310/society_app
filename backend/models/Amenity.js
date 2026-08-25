const mongoose = require("mongoose");

// =======================================================
// AMENITY
//
// The clubhouse, the gym, the terrace. What the committee lists as
// bookable, and the rules a booking has to fit inside.
// =======================================================

const amenitySchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
    default: "",
  },

  //The app picks an illustration from this; unknown values fall back
  //rather than failing, so the set can grow on the client first.
  icon: {
    type: String,
    default: "sparkles",
  },

  //Stored as "HH:MM" in 24-hour form. A Date would carry a day with
  //it, which is meaningless for "the gym opens at six".
  openTime: {
    type: String,
    default: "06:00",
  },

  closeTime: {
    type: String,
    default: "22:00",
  },

  chargePerHour: {
    type: Number,
    default: 0,
    min: 0,
  },

  slotDurationMinutes: {
    type: Number,
    default: 60,
    min: 15,
    max: 24 * 60,
  },

  //A hall people hold parties in needs the committee to agree; a
  //treadmill does not.
  requiresApproval: {
    type: Boolean,
    default: false,
  },

  //Taken out of service without losing its booking history.
  isBookable: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });

amenitySchema.index({ societyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Amenity", amenitySchema);
