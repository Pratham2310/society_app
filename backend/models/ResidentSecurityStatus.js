const mongoose=require("mongoose");

const residentSecurityStatusSchema=new mongoose.Schema({
    residentId:{
        type:mongoose.Types.ObjectId,
        ref:"User",
        required:true,
        unique:true
    },
    societyId:{
        type:mongoose.Types.ObjectId,
        ref:"Society",
        required:true,
        unique:true
    },
    status:{
        type:String,
        enum:["at_home","away","do_not_disturb"],
        default:"at_home"
    },
    instructions:{
        type:String,
        default:""
    },
    from:Date,
    to:Date,
    autoReset:{
        type:Boolean,
        default:true
    }
},{timestamps:true});
module.exports=mongoose.model("ResidentSecurityStatus",residentSecurityStatusSchema);