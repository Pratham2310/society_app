// models/notice.model.js
const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  wingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wing",
    default: null
  },

  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: ["notice", "announcement"],
    required: true
  },

  category: {
    type: String,
    enum: ["security", "amenities", "general"],
    default: "general"
  },

  isUrgent: {
    type: Boolean,
    default: false
  },

  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "published"
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  validTill: Date

}, { timestamps: true });

noticeSchema.index({ societyId: 1, createdAt: -1 });

module.exports = mongoose.model("Notice", noticeSchema);