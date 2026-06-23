const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const serviceSchema = new Schema({

  name: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    enum: [
      "health",
      "education",
      "shopping",
      "maintenance",
      "emergency",
      "others"
    ],
    default: "others"
  },

  description: {
    type: String,
    maxlength: 500
  },

  image: {
    type: String,
    default: null
  },

  phone: {
    type: String,
    required: true
  },

  address: {
    type: String,
    default: ""
  },

  openTime: {
    type: String,
    default: ""
  },

  closeTime: {
    type: String,
    default: ""
  },

  is24Hours: {
    type: Boolean,
    default: false
  },

  latitude: {
    type: Number,
    default: null
  },

  longitude: {
    type: Number,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model(
  "Service",
  serviceSchema
);