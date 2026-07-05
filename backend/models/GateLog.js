const mongoose = require("mongoose");
const Schema= mongoose.Schema;

const guestLogSchema = new mongoose.Schema({
  // society information
  societyId: {
    type: Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  // guest pass information
  guestPassId: {
    type: Schema.Types.ObjectId,
    ref: "GuestPass",
    required: true,
  },

  // resident information
  residentId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  flatId:{
    type: Schema.Types.ObjectId,
    ref:"Flat",
    required:true
  },
  wingId:{
    type:Schema.Types.ObjectId,
    ref:"Wing",
    required:true
  },


  //guard information
  guardId:{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  approvedBy:{
    type:Schema.Types.ObjectId,
    ref:"User",
    default:null
  },


  //visitor information

  visitorType:{
    type:String,
    enum:["guest","delivery","staff","resident","emergency","unknown"],
    required:true
  },
  visitorName:{
    type:String,
    required:true,
    trim:true,
    maxlength:100
  },
  visitorPhone:{
    type:String,
    required:true,
    default:null,
    trim:true,
    match:[/^[0-9]{10}$/,"Invalid phone number"],
  },
  vehicleNumber:{
    type:String,
    trim:true,
    uppercase:true,
    default:null
  },
  vehicleType:{
    type:String,
    enum:["car","bike","auto","taxi","truck","other"],
    default:"other"
  },
  purpose:{
    type:String,
    trim:true,
    default:null
  },

  //access information
  scanType:{
    type:String,
    enum:["entry","exit"],
    required:true
  },
  status:{
    type:String,
    enum:["completed","rejected","canceled"],
    default:"completed"
  },
  scanTime:{
    type:Date,
    default:Date.now
  },

  //verification

  verificationMethod:{
    type:String,
    enum:["qr","manual","resident confirmation","secretary override","emergency"],
    default:"qr"
  },

  gateName:{
    type:String,
    trim:true,
    default:"main Gate"
  },
  device:{
    type:String,
    trim:true,
    default:null
  },

  //rejection information
  rejectionReason:{
    type:String,
    trim:true,
    default:null
  },


  //remark
  remarks: [
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
],

  // ======================================================
// Guard Notes (Audit Trail)
// ======================================================

guardNotes: [
  {
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  ],

  //future metadata
  metadata:{
    type:Schema.Types.Mixed,
    default:{},
  },
},{timestamps:true},
  {versionKey:false}
);


// ======================================================
// Indexes
// ======================================================

// Resident History
gateLogSchema.index({
  societyId: 1,
  residentId: 1,
  scanTime: -1,
});

// Guard History
gateLogSchema.index({
  societyId: 1,
  guardId: 1,
  scanTime: -1,
});

// Guest Pass History
gateLogSchema.index({
  guestPassId: 1,
  scanTime: -1,
});

// Visitor Search
gateLogSchema.index({
  societyId: 1,
  visitorPhone: 1,
});

gateLogSchema.index({
  societyId: 1,
  visitorName: 1,
});

// Daily Timeline
gateLogSchema.index({
  societyId: 1,
  scanTime: -1,
});

// Gate Wise Analytics
gateLogSchema.index({
  societyId: 1,
  gateName: 1,
});

// Entry / Exit Analytics
gateLogSchema.index({
  societyId: 1,
  scanType: 1,
});

// Verification Analytics
gateLogSchema.index({
  societyId: 1,
  verificationMethod: 1,
});

// Status Analytics
gateLogSchema.index({
  societyId: 1,
  status: 1,
});

// Visitor Type Analytics
gateLogSchema.index({
  societyId: 1,
  visitorType: 1,
});

// Flat Wise Reports
gateLogSchema.index({
  societyId: 1,
  wingId: 1,
  flatId: 1,
});

module.exports = mongoose.model(
  "GateLog",
  gateLogSchema
);