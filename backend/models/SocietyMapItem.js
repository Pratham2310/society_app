const mongoose = require("mongoose");

// =======================================================
// SOCIETY MAP ITEM
//
// A pin on the society's layout: which catalogue service sits where.
// Position is a percentage of the plan rather than pixels, so the same
// coordinates land correctly on a phone and a tablet.
// =======================================================

const mapItemSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },

  //Overrides the catalogue name for this society only — the same
  //chain is "Gate 1 Kirana" here and something else next door.
  customName: {
    type: String,
    trim: true,
    default: "",
  },

  mapPosition: {
    x: { type: Number, default: 50, min: 0, max: 100 },
    y: { type: Number, default: 50, min: 0, max: 100 },
  },

  status: {
    type: String,
    enum: ["open", "closed", "temporarily_closed"],
    default: "open",
  },

  notes: {
    type: String,
    trim: true,
    maxlength: 300,
    default: "",
  },

}, { timestamps: true });

module.exports = mongoose.model("SocietyMapItem", mapItemSchema);
