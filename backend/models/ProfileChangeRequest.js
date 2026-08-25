const mongoose = require("mongoose");

// =======================================================
// PROFILE CHANGE REQUEST
//
// A resident editing their own name or flat details does not get to
// apply it themselves. The society's records are what the committee
// bills against and what the guard checks at the gate, so a change
// goes to the secretary first.
//
// The requested values are held here rather than written to the user
// and flagged, so a pending request never leaks into anything that
// reads the profile.
// =======================================================

const profileChangeRequestSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // What the resident asked for. Only the fields they actually changed
  // are stored, so approving one cannot quietly revert another.
  requested: {
    name: String,
    email: String,
    occupancyType: { type: String, enum: ["owner", "tenant"] },
    livingType: { type: String, enum: ["family", "bachelor", "commercial"] },
    familySize: Number,
  },

  // What those fields held when the request was raised, so the
  // secretary sees the change rather than just the new values.
  previous: {
    name: String,
    email: String,
    occupancyType: String,
    livingType: String,
    familySize: Number,
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    index: true,
  },

  decidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  decidedAt: {
    type: Date,
    default: null,
  },

  rejectionReason: {
    type: String,
    trim: true,
    maxlength: 300,
    default: null,
  },

}, { timestamps: true });

// The secretary's queue: this society's pending requests, newest first.
profileChangeRequestSchema.index({ societyId: 1, status: 1, createdAt: -1 });

// One open request per resident. A second edit replaces the first
// rather than queueing, which is handled in the service with an
// upsert — without this index a race could leave two pending.
profileChangeRequestSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("ProfileChangeRequest", profileChangeRequestSchema);
