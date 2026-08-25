const mongoose=require("mongoose");
const visitorRequestSchema=new mongoose.Schema({
    societyId:{
        type:mongoose.Types.ObjectId,
        ref:"Society",
        required:true
    },
    residentId:{
        type:mongoose.Types.ObjectId,
        ref:"User",
        required:true
    },
    visitorName:{
        type:String,
        required:true
    },
    purpose:{
        type:String,
        enum:["delivery","guest","maintainance","other"],
        required:true,
        default:"other"
    },
    visitoryPhoto:String,
    vehicleNumber:String,
    vehiclePhoto:String,
    messageToGaurd:String,
    status:{
        type:String,
        enum:["pending","approved","rejected","fraud_reported","expired"],
        default:"pending"
    },
    approvedAt:Date,
    rejectedAt:Date,
    //The pass the guard scans at the gate. passCode is what a resident
    //reads out when the QR will not scan; qr is the rendered image.
    passCode:{
        type:String,
        default:null,
        index:true
    },
    qr:{
        type:String,
        default:null
    },
    passExpiresAt:Date,

    //A pass raised by the guard for a walk-up rather than by a resident
    //expecting someone. Both look the same at the gate, but only one
    //needed the resident to approve it first.
    createdByGuard:{
        type:mongoose.Types.ObjectId,
        ref:"User",
        default:null
    },

    visitorPhone:String,
    visitorType:{
        type:String,
        enum:["delivery","guest","staff","other"],
        default:"guest"
    },

    //Set when the pass is actually scanned, which is what separates
    //expected from at-the-gate from gone home again.
    entryTime:Date,
    exitTime:Date,

    fraudReported:{
        type:Boolean,
        default:false
    },
},{timestamps:true});

module.exports=mongoose.model("VisitorRequest",visitorRequestSchema);