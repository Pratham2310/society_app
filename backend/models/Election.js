const mongoose = require("mongoose");

// =======================================================
// ELECTION
//
// A committee election: some posts, some candidates, a window to vote
// in, and a count at the end.
//
// Status is not stored. It follows from the dates and two flags, and a
// stored copy would need a job to keep it honest — an election would
// sit at "scheduled" past its own opening because nothing ran. See
// statusOf in electionService.
// =======================================================

const electionSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  title: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
    default: "",
  },

  //Which posts are up, and how many seats each carries. Chairman is
  //one seat; committee member is usually several.
  posts: [
    {
      post: {
        type: String,
        enum: ["chairman", "secretary", "treasurer", "committee_member"],
        required: true,
      },
      seats: { type: Number, default: 1, min: 1, max: 20 },
      _id: false,
    },
  ],

  opensAt: { type: Date, required: true },
  closesAt: { type: Date, required: true },

  //Set when the count is published. Until then a closed election is
  //"awaiting count" rather than finished.
  closedAt: { type: Date, default: null },

  cancelledAt: { type: Date, default: null },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

}, { timestamps: true });

electionSchema.index({ societyId: 1, opensAt: -1 });

module.exports = mongoose.model("Election", electionSchema);
