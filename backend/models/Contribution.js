const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const contributionSchema = new Schema({

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
  }

}, { timestamps: true });

module.exports = mongoose.model("Contribution", contributionSchema);