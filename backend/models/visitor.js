const mongoose=require("mongoose");

const visitorSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society"
  },

  flatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Flat"
  },

  name: String,
  phone: String,

  purpose: String,

  vehicleNumber: String,

  entryTime: {
    type: Date,
    default: Date.now
  },

  exitTime: Date,

  approved: {
    type: Boolean,
    default: false
  },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
},
{timestamps:true});

module.exports = mongoose.model("Visitor", visitorSchema);