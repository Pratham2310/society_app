const mongoose = require("mongoose");

// =======================================================
// ELECTION CANDIDATE
//
// A resident standing for one post in one election. Somebody may
// stand for two different posts, so the uniqueness is on the pair,
// not on the person.
// =======================================================

const candidateSchema = new mongoose.Schema({

  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Society",
    required: true,
    index: true,
  },

  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  post: {
    type: String,
    enum: ["chairman", "secretary", "treasurer", "committee_member"],
    required: true,
  },

  statement: {
    type: String,
    trim: true,
    maxlength: 500,
    default: "",
  },

}, { timestamps: true });

// Standing twice for the same post is a mistake every time, and it
// would split the person's own vote.
candidateSchema.index(
  { electionId: 1, post: 1, userId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ElectionCandidate", candidateSchema);
