const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const contributionSchema = new Schema({

  // Without this the tenant plugin does not apply, and any query not
  // already narrowed by fundId — the society-wide contributor wall,
  // for one — would read across societies.
  societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true
  },

  fundId: {
    type: Schema.Types.ObjectId,
    ref: "CommunityFund",
    required: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  proof: String, // image URL

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  // What the resident quotes when asking the treasurer about a payment.
  // Assigned on verification, because an unverified contribution is not
  // yet a receipt for anything.
  receiptNo: {
    type: String,
    default: null,
    index: true
  },

  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  verifiedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

contributionSchema.index({ societyId: 1, status: 1, createdAt: -1 });
contributionSchema.index({ fundId: 1, status: 1 });

module.exports = mongoose.model("Contribution", contributionSchema);