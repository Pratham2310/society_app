const mongoose = require("mongoose");

// =======================================================
// AUDIT LOG
//
// A record of who did what, for the actions people argue about:
// money, approvals, role changes, and anything an admin does on
// someone else's behalf.
//
// Deliberately append-only. Application code writes; nothing in
// the app updates or deletes. If a treasurer disputes a payment
// six months from now, this is the only thing that can answer it.
// =======================================================

const auditLogSchema = new mongoose.Schema(
  {
    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      index: true,
    },

    //Who performed it.
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    actorRole: String,

    //What happened, as a stable machine-readable verb.
    action: {
      type: String,
      required: true,
      index: true,
    },

    //What it happened to.
    targetType: String,

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    //Enough context to explain the entry without joining anything.
    //Never store credentials, tokens or full request bodies here.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    //Ties an entry back to the request logs and Sentry event.
    requestId: String,

    ip: String,

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { versionKey: false }
);

//The two questions actually asked of an audit log: what did this
//person do, and what happened to this record.
auditLogSchema.index({ societyId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
