const mongoose = require("mongoose");

// =======================================================
// IDEMPOTENCY KEY
//
// A guard scanning a QR at the gate is on the worst network in the
// building. The app retries; without this, one visitor becomes two
// gate log entries. Same for a payment recorded twice.
//
// The client sends an Idempotency-Key header. The first request
// stores its response against that key; a retry gets the stored
// response back instead of executing again.
// =======================================================

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },

    //Scoped per user so one caller's key cannot collide with, or
    //return another caller's response.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    //Method + path, so the same key reused on a different endpoint
    //is treated as a mistake rather than silently replaying.
    endpoint: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },

    statusCode: Number,

    response: mongoose.Schema.Types.Mixed,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false }
);

//One record per key per user. The unique index is what makes a
//concurrent double-submit safe: the second insert loses the race.
idempotencyKeySchema.index(
  { userId: 1, key: 1 },
  { unique: true }
);

//Keys are only useful for as long as a client might retry.
idempotencyKeySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 }
);

module.exports = mongoose.model("IdempotencyKey", idempotencyKeySchema);
