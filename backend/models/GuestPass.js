const mongoose = require("mongoose");

const guestPassSchema = new mongoose.Schema(
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
    },

    wingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wing",
      required: true,
    },

    // ======================================================
    // Guest Information
    // ======================================================
    guestName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    guestPhone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9]{10}$/, "Invalid phone number"],
    },

    guestPhoto: {
      type: String,
      default: null,
      trim: true,
    },

    // ======================================================
    // Visit Information
    // ======================================================
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

    vehicleNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },

    numberOfGuests: {
      type: Number,
      default: 1,
      min: 1,
      max: 20,
    },

    arrivalDate: {
      type: Date,
      required: true,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    passType: {
      type: String,
      enum: [
        "one_time",
        "multi_day",
        "permanent",
      ],
      default: "one_time",
    },

    // ======================================================
    // QR Information
    // ======================================================
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    qrCode: {
      type: String,
      default: null,
    },

    qrVersion: {
      type: Number,
      default: 1,
    },

    lastQrGeneratedAt: {
      type: Date,
      default: Date.now,
    },

    regeneratedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // Pass Status
    // ======================================================
    status: {
      type: String,
      enum: [
        "active",
        "suspended",
        "cancelled",
        "expired",
      ],
      default: "active",
      index: true,
    },

    statusReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: 250,
    },

    lastScannedAt: {
      type: Date,
      default: null,
    },


        // ======================================================
    // Extension Information
    // ======================================================
    extendedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    extensionHistory: [
      {
        previousExpiry: {
          type: Date,
          required: true,
        },

        newExpiry: {
          type: Date,
          required: true,
        },

        extendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        extendedAt: {
          type: Date,
          default: Date.now,
        },

        reason: {
          type: String,
          trim: true,
          default: null,
        },
      },
    ],

    // ======================================================
    // Status History (Audit Trail)
    // ======================================================
    statusHistory: [
      {
        previousStatus: {
          type: String,
        },

        newStatus: {
          type: String,
        },

        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },

        reason: {
          type: String,
          trim: true,
          default: null,
        },
      },
    ],

    // ======================================================
    // Additional Information
    // ======================================================
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    createdSource: {
      type: String,
      enum: [
        "resident",
        "secretary",
        "admin",
      ],
      default: "resident",
    },

    // ======================================================
    // Approval Information
    // ======================================================
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    // ======================================================
    // Notification Information
    // ======================================================
    lastNotificationSentAt: {
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

// ======================================================
// Production Indexes
// ======================================================

// Resident Dashboard
guestPassSchema.index({
  societyId: 1,
  residentId: 1,
});

// Active / Suspended / Cancelled
guestPassSchema.index({
  societyId: 1,
  status: 1,
});

// Expiry Scheduler
guestPassSchema.index({
  societyId: 1,
  expiryDate: 1,
});

// Pass Type Filter
guestPassSchema.index({
  societyId: 1,
  passType: 1,
});

// QR Lookup
guestPassSchema.index({
  qrToken: 1,
});

// Guest Search
guestPassSchema.index({
  societyId: 1,
  guestPhone: 1,
});

guestPassSchema.index({
  societyId: 1,
  guestName: 1,
});

// Timeline
guestPassSchema.index({
  societyId: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "GuestPass",
  guestPassSchema
);

module.exports=mongoose.model("GuestPass",guestPassSchema);