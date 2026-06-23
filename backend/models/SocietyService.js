const mongoose = require("mongoose");

const societyServiceSchema =
  new mongoose.Schema({

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true
    },

    societyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Society",
      required: true
    },

    isRecommended: {
      type: Boolean,
      default: false
    },

    isEmergency: {
      type: Boolean,
      default: false
    },

    notes: {
      type: String,
      default: ""
    },

    isVisible: {
      type: Boolean,
      default: true
    }

  }, { timestamps: true });


// prevent duplicate assignment
societyServiceSchema.index({
  serviceId: 1,
  societyId: 1
}, {
  unique: true
});


module.exports =
  mongoose.models.SocietyService ||

  mongoose.model(
    "SocietyService",
    societyServiceSchema
  );