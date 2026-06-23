const mongoose=require("mongoose");

const fundSchema = new mongoose.Schema({
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society"
  },

  wingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wing",
    default: null
  },

  title: String,
  description: String,

  fundType: {
    type: String,
    enum: ["mandatory", "optional"]
  },

  fundScope: {
    type: String,
    enum: ["flat", "wing", "society"]
  },

  amount: Number,

  dueDate: Date,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
},
{timestamps:true});

module.exports = mongoose.model("Fund", fundSchema);