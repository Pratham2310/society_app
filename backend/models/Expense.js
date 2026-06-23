const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const expenseSchema=new Schema({

    societyId: {
        type: Schema.Types.ObjectId,
        ref: "Society",
        required: true
    },

    title: {
        type: String,
        required: true
    },

    category: {
        type: String,
        enum: ["maintenance", "electricity", "security", "other"]
    },

    amount: {
        type: Number,
        required: true
    },

    description: String,

    billFile: String, // URL (PDF/Image)

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },

    isPublished: {
        type: Boolean,
        default: false
    },

    visibleToResidents: {
        type: Boolean,
        default: false
    }

    }, { timestamps: true }
)

module.exports=mongoose.model("Expense",expenseSchema);