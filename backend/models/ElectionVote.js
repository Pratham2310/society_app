const mongoose = require("mongoose");

// =======================================================
// ELECTION VOTE
//
// One vote, by one resident, for one post.
//
// The voter is recorded because the unique index below is the only
// thing stopping someone voting twice — a tally without it would be
// worthless. That means the ballot is not secret from the database,
// which is the honest trade: nothing reads voterId back out except
// the duplicate check and "have I voted yet", and no endpoint ever
// returns who voted for whom.
// =======================================================

const voteSchema = new mongoose.Schema({

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

  post: {
    type: String,
    required: true,
  },

  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ElectionCandidate",
    required: true,
    index: true,
  },

  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

}, { timestamps: true });

// One vote per resident per post. This is the whole integrity story:
// enforced by the database, not by a check the service could skip
// under a race.
voteSchema.index(
  { electionId: 1, post: 1, voterId: 1 },
  { unique: true }
);

module.exports = mongoose.model("ElectionVote", voteSchema);
