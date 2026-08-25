const mongoose=require("mongoose");

const residentSecurityStatusSchema=new mongoose.Schema({
    residentId:{
        type:mongoose.Types.ObjectId,
        ref:"User",
        required:true
    },
    societyId:{
        type:mongoose.Types.ObjectId,
        ref:"Society",
        required:true
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
    },

    //When a temporary status lapses on its own. The app offers "1 hour"
    //through "until I change it", and the last of those leaves this
    //null.
    expiresAt:{
        type:Date,
        default:null
    }
},{timestamps:true});

//Both fields were previously marked unique individually, which meant
//only ONE resident per society could ever hold a status record. The
//constraint that was actually intended is one record per resident
//per society.
residentSecurityStatusSchema.index(
    {societyId:1,residentId:1},
    {unique:true}
);

module.exports=mongoose.model("ResidentSecurityStatus",residentSecurityStatusSchema);