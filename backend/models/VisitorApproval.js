const mongoose = require("mongoose");

const visitorApprovalSchema = new mongoose.Schema(
  {

    // ======================================================
    // Society Information
    // ======================================================

    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true,
      index: true,
    },

    residentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      required: true,
      index: true,
    },

    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wing",
      required: true,
      index: true,
    },

    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ======================================================
    // Visitor Information
    // ======================================================

    visitorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    visitorPhone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Invalid phone number"],
    },

    visitorPhoto: {
      type: String,
      default: null,
      trim: true,
    },

    vehicleNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },

    purpose: {
      type: String,
      enum: [
        "family",
        "friend",
        "delivery",
        "maintenance",
        "business",
        "other",
      ],
      default: "other",
    },

    numberOfVisitors: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },

    // ======================================================
    // Approval Information
    // ======================================================

    approvalStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ======================================================
    // Guest Pass Information
    // ======================================================

    guestPassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GuestPass",
      default: null,
      index: true,
    },

    // ======================================================
    // Notification Information
    // ======================================================

    notificationSentAt: {
      type: Date,
      default: null,
    },

    // ======================================================
    // Future Metadata
    // ======================================================

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ======================================================
    // Audit Information
    // ======================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

  },
  {
    timestamps: true,
    versionKey: false,
  }
);

//
// ======================================================
// Production Indexes
// ======================================================

// Resident Pending Requests
visitorApprovalSchema.index({
  societyId: 1,
  residentId: 1,
  approvalStatus: 1,
});

// Guard Pending Requests
visitorApprovalSchema.index({
  societyId: 1,
  guardId: 1,
  approvalStatus: 1,
});

// Expiry Scheduler
visitorApprovalSchema.index({
  approvalStatus: 1,
  expiresAt: 1,
});

// Flat History
visitorApprovalSchema.index({
  societyId: 1,
  flatId: 1,
});

// Timeline
visitorApprovalSchema.index({
  societyId: 1,
  createdAt: -1,
});

// Guest Pass Link
visitorApprovalSchema.index({
  guestPassId: 1,
});

module.exports = mongoose.model(
  "VisitorApproval",
  visitorApprovalSchema
);