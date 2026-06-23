const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
{
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    societyId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Society",
        required:true
    },

    title: {
        type: String,
        required: true
    },

    message: {
        type: String
    },

    type: {
        type: String,
        enum: [
            "notice",
            "announcement",
            "complaint",
            "fund",
            "general"
        ]
    },

    isRead: {
        type: Boolean,
        default: false
    }

},
{ timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);