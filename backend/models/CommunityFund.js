const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const communityFundSchema=new Schema({
     societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    required: true
  },

  title: {
    type: String,
    required: true
  },

  description: String,

  targetAmount: {
    type: Number,
    required: true
  },

  collectedAmount: {
    type: Number,
    default: 0
  },

  startDate: Date,

  endDate: Date,

  status: {
    type: String,
    enum: ["active", "closed"],
    default: "active"
  },

  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }

},{timestamps:true});

module.exports=mongoose.model("communityFund",communityFundSchema);