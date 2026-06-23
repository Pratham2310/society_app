const mongoose = require("mongoose");

const Schema=mongoose.Schema;

const wingSchema=new Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    societyId:{
        type:Schema.Types.ObjectId,
        ref:"Society",
        required:true
    },
    totalFloors:{
        type:Number,
        required:true
    },
    flatsPerFloor:{
        type:Number,
        required:true
    }
},
{timestamps:true}
);

wingSchema.index({name:1,societyId:1},{unique:true});

module.exports=mongoose.model("Wing",wingSchema);