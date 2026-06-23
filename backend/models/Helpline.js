const mongoose=require("mongoose");

const helpLineSchema=new mongoose.Schema({
    societyId:{
        type:mongoose.Types.ObjectId,
        ref:"Society",
        required:true,
    },
    title:{
        type:String,
        required:true,
        trim:true
    },
    category:{
        type:String,
        enum:["emergency","housholds","maintenance","food","security","medical","other"],
        default:"other"
    },
    phone:{
        type:String,
        default:""
    },
    alternatePhone:{
        type:String,
        default:""
    },
    description:{
        type:String,
        default:""
    },
    availability:{
        type:String,
        default:"24/7"
    },
    isPinned:{
        type:Boolean,
        default:false
    },
    isActive:{
        type:Boolean,
        default:true
    }
},{timestamps:true});

module.exports=mongoose.models.Helpline || mongoose.model("Helpline",helpLineSchema);

