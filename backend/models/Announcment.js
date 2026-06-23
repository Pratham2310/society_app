const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const announcementSchema=new Schema({
    societyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Society",
        required: true
    },

    title: {
        type: String,
        required: true
    },

    category: {
        type: String,
        enum: ["security", "amenities", "general"],
        required: true
    },

    description: {
        type: String,
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

},
{ timestamps: true }
);

module.exports=mongoose.model("Announcement",announcementSchema);