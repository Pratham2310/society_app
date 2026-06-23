const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const inviteSchema=new Schema({
    email:{
        type:String,
        required:true
    },
    societyId:{
        type:Schema.Types.ObjectId,
        ref:"Society",
        required:true
    },
    flatId:{
        type:Schema.Types.ObjectId,
        ref:"Flat",
        required:true
    },
    role:{
        type:String,
        enum:["resident","comiteeMember","security"],
        default:"resident"
    },
    token:{
        type:String,
        required:true
    },
    expiresAt:{
        type:Date,
        required:true
    },
    used:{
        type:Boolean,
        default:false
    }
},
{timestamps:true});

module.exports=mongoose.model("Invite",inviteSchema);