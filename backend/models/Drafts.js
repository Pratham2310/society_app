const mongoose=require("mongoose");
const schema=mongoose.Schema;

const draftSchema=new schema({
    createdBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    step:{
        type:Number,
        default:1
    },
    data:{
        type:Object,
        default:{}
    },
    status:{
        type:String,
        enum:["draft","completed"],
        default:"draft"
    }

},
{timestamps:true});

module.exports=mongoose.model("Draft",draftSchema);