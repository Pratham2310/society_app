const mongoose = require("mongoose");

const User = require("../models/User");
const Election = require("../models/Election");
const ElectionCandidate = require("../models/ElectionCandidate");
const ElectionVote = require("../models/ElectionVote");

const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");

// =======================================================
// ELECTIONS
//
// Committee elections. Two rules carry the whole thing:
//
//   One vote per resident per post, enforced by a unique index rather
//   than by a check in here — under two simultaneous taps a check
//   loses and an index does not.
//
//   Nobody sees a count before the election closes. Returning running
//   totals during voting would change how people vote, so results are
//   withheld until the count is published.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const canManage = (user) => has(user, PERMISSIONS.ELECTIONS_MANAGE);

const requireManage = (user) => {
  if (!canManage(user)) {
    throw new AppError("Only the committee can run elections.", 403);
  }
};

const POSTS = ["chairman", "secretary", "treasurer", "committee_member"];

// =======================================================
// STATUS
//
// Derived, never stored. A stored copy would need something to run on
// a schedule to keep it true, and an election would otherwise sit at
// "scheduled" hours past its own opening because nothing did.
// =======================================================

const statusOf = (election, now = Date.now()) => {

  if (election.cancelledAt) return "cancelled";
  if (election.closedAt) return "completed";

  const opens = new Date(election.opensAt).getTime();
  const closes = new Date(election.closesAt).getTime();

  if (now < opens) return "scheduled";
  if (now <= closes) return "open";

  // Voting is over but nobody has published the count yet.
  return "awaiting_count";

};

exports.statusOf = statusOf;

const shapeElection = (election, extra = {}) => ({
  _id: election._id,
  title: election.title,
  description: election.description || "",
  posts: election.posts || [],
  opensAt: election.opensAt,
  closesAt: election.closesAt,
  status: statusOf(election),
  ...extra,
});

// =======================================================
// LIST AND DETAIL
// =======================================================

exports.listElections = async (req) => {

  const societyId = asId(req.user.societyId);

  const elections = await Election.find({ societyId })
    .sort({ opensAt: -1 })
    .limit(50)
    .lean();

  if (!elections.length) return [];

  // Which posts this resident has already voted on, so the list can
  // say "you have voted" without a query per row.
  const myVotes = await ElectionVote.find({
    societyId,
    voterId: req.user.id,
    electionId: { $in: elections.map((e) => e._id) },
  })
    .select("electionId post")
    .lean();

  const byElection = new Map();

  for (const vote of myVotes) {
    const key = String(vote.electionId);
    if (!byElection.has(key)) byElection.set(key, []);
    byElection.get(key).push(vote.post);
  }

  return elections.map((e) =>
    shapeElection(e, {
      myVotedPosts: byElection.get(String(e._id)) || [],
    })
  );

};

exports.getElection = async (req) => {

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({
    _id: req.params.id,
    societyId,
  }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  const [candidates, myVotes, totalVoters] = await Promise.all([

    ElectionCandidate.find({ electionId: election._id, societyId })
      .populate("userId", "name flatNumber avatar")
      .sort({ post: 1, createdAt: 1 })
      .lean(),

    ElectionVote.find({
      electionId: election._id,
      societyId,
      voterId: req.user.id,
    })
      .select("post")
      .lean(),

    // Turnout is against people who could have voted, not against
    // however many happened to.
    User.countDocuments({
      societyId,
      status: "approved",
      societyRole: { $ne: "security" },
    }),

  ]);

  const status = statusOf(election);

  const shaped = shapeElection(election, {
    myVotedPosts: myVotes.map((v) => v.post),
    candidates: candidates
      .filter((c) => c.userId)
      .map((c) => ({
        _id: c._id,
        post: c.post,
        statement: c.statement || "",
        name: c.userId.name,
        flatNumber: c.userId.flatNumber || "",
        userId: String(c.userId._id),
      })),
  });

  // Turnout as a share of eligible residents who cast at least one
  // vote — not the raw ballot count, which double-counts anyone who
  // voted on several posts.
  const distinctVoters = await ElectionVote.distinct("voterId", {
    electionId: election._id,
    societyId,
  });

  shaped.turnout = totalVoters > 0
    ? Math.round((distinctVoters.length / totalVoters) * 100)
    : 0;

  // Results only once the count is published. A running tally during
  // voting would change how people vote.
  if (status === "completed") {
    shaped.results = await tally(election._id, societyId, candidates);
  }

  return shaped;

};

const tally = async (electionId, societyId, candidates) => {

  const counts = await ElectionVote.aggregate([
    { $match: { electionId: asId(electionId), societyId: asId(societyId) } },
    { $group: { _id: "$candidateId", votes: { $sum: 1 } } },
  ]);

  const byCandidate = new Map(counts.map((c) => [String(c._id), c.votes]));

  const results = {};

  for (const candidate of candidates) {

    if (!candidate.userId) continue;

    if (!results[candidate.post]) results[candidate.post] = [];

    results[candidate.post].push({
      candidateId: String(candidate._id),
      name: candidate.userId.name,
      flatNumber: candidate.userId.flatNumber || "",
      votes: byCandidate.get(String(candidate._id)) || 0,
    });

  }

  // Highest first, so the app can read the winners off the top without
  // knowing how many seats each post carries.
  for (const post of Object.keys(results)) {
    results[post].sort((a, b) => b.votes - a.votes);
  }

  return results;

};

// =======================================================
// CREATING
// =======================================================

exports.createElection = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const title = String(req.body.title || "").trim();

  if (!title) throw new AppError("Give the election a title.", 400);

  const posts = Array.isArray(req.body.posts) ? req.body.posts : [];

  if (!posts.length) throw new AppError("Choose at least one post.", 400);

  const cleanPosts = [];
  const seen = new Set();

  for (const entry of posts) {

    const post = String(entry?.post || "").trim();

    if (!POSTS.includes(post)) {
      throw new AppError(`Unknown post: ${post || "(blank)"}.`, 400);
    }

    if (seen.has(post)) {
      throw new AppError(`${post} is listed twice.`, 400);
    }

    seen.add(post);

    const seats = Number(entry.seats ?? 1);

    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
      throw new AppError("Seats must be between 1 and 20.", 400);
    }

    cleanPosts.push({ post, seats });

  }

  const opensAt = new Date(req.body.opensAt);
  const closesAt = new Date(req.body.closesAt);

  if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
    throw new AppError("Enter valid opening and closing dates.", 400);
  }

  if (closesAt <= opensAt) {
    throw new AppError("Voting has to close after it opens.", 400);
  }

  const session = await mongoose.startSession();

  let election;

  try {

    await session.withTransaction(async () => {

      const created = await Election.create([{
        societyId,
        title,
        description: String(req.body.description || "").trim(),
        posts: cleanPosts,
        opensAt,
        closesAt,
        createdBy: req.user.id,
      }], { session });

      election = created[0];

      // The create screen sends the candidate list with the election.
      // Both have to land or neither: an election with no candidates
      // that nobody noticed is worse than a failed request.
      const candidates = Array.isArray(req.body.candidates)
        ? req.body.candidates
        : [];

      if (!candidates.length) return;

      const rows = [];

      for (const entry of candidates) {

        const post = String(entry?.post || "").trim();

        if (!seen.has(post)) {
          throw new AppError(`${post || "A candidate"} is not standing for a post in this election.`, 400);
        }

        if (!entry.userId) throw new AppError("Every candidate needs a resident.", 400);

        rows.push({
          societyId,
          electionId: election._id,
          userId: entry.userId,
          post,
          statement: String(entry.statement || "").trim(),
        });

      }

      // Everyone standing must actually live here.
      const ids = [...new Set(rows.map((r) => String(r.userId)))];

      const residents = await User.find({
        _id: { $in: ids },
        societyId,
        status: "approved",
      })
        .select("_id")
        .session(session)
        .lean();

      if (residents.length !== ids.length) {
        throw new AppError("A candidate is not an approved resident here.", 400);
      }

      await ElectionCandidate.insertMany(rows, { session });

    });

  } finally {
    await session.endSession();
  }

  return shapeElection(election.toObject(), { myVotedPosts: [], candidates: [] });

};

// =======================================================
// CANDIDATES
// =======================================================

exports.addCandidate = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({ _id: req.params.id, societyId }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  const status = statusOf(election);

  // Adding someone once voting has started would mean the residents
  // who already voted never saw them on the ballot.
  if (status !== "scheduled") {
    throw new AppError("Voting has started. The ballot is fixed.", 409);
  }

  const post = String(req.body.post || "").trim();

  if (!(election.posts || []).some((p) => p.post === post)) {
    throw new AppError("That post is not up in this election.", 400);
  }

  const resident = await User.findOne({
    _id: req.body.userId,
    societyId,
    status: "approved",
  })
    .select("name flatNumber avatar")
    .lean();

  if (!resident) throw new AppError("That resident is not in this society.", 404);

  try {

    const candidate = await ElectionCandidate.create({
      societyId,
      electionId: election._id,
      userId: resident._id,
      post,
      statement: String(req.body.statement || "").trim(),
    });

    return {
      _id: candidate._id,
      post,
      statement: candidate.statement,
      name: resident.name,
      flatNumber: resident.flatNumber || "",
      userId: String(resident._id),
    };

  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError("They are already standing for that post.", 409);
    }
    throw err;
  }

};

exports.removeCandidate = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({ _id: req.params.id, societyId }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  if (statusOf(election) !== "scheduled") {
    throw new AppError("Voting has started. The ballot is fixed.", 409);
  }

  const candidate = await ElectionCandidate.findOneAndDelete({
    _id: req.params.candidateId,
    electionId: election._id,
    societyId,
  }).lean();

  if (!candidate) throw new AppError("Candidate not found.", 404);

  return { removed: candidate._id };

};

// =======================================================
// VOTING
// =======================================================

exports.vote = async (req) => {

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({ _id: req.params.id, societyId }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  const status = statusOf(election);

  if (status === "scheduled") throw new AppError("Voting has not opened yet.", 409);
  if (status === "cancelled") throw new AppError("That election was cancelled.", 409);
  if (status !== "open") throw new AppError("Voting has closed.", 409);

  const candidate = await ElectionCandidate.findOne({
    _id: req.body.candidateId,
    electionId: election._id,
    societyId,
  }).lean();

  if (!candidate) throw new AppError("That candidate is not on this ballot.", 404);

  // The post comes from the candidate, not the body. Trusting the body
  // would let someone spend their chairman vote on a committee
  // candidate and then vote for chairman again.
  const post = candidate.post;

  // A guard is staff, not a resident, and does not get a vote.
  if (req.user.societyRole === "security") {
    throw new AppError("Society staff do not vote in resident elections.", 403);
  }

  try {

    await ElectionVote.create({
      societyId,
      electionId: election._id,
      post,
      candidateId: candidate._id,
      voterId: req.user.id,
    });

  } catch (err) {
    // The unique index is what actually enforces one vote per post.
    // Under two simultaneous taps a check would lose; this does not.
    if (err?.code === 11000) {
      throw new AppError("You have already voted for that post.", 409);
    }
    throw err;
  }

  return { voted: true, post };

};

// =======================================================
// CLOSING
// =======================================================

exports.closeElection = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({ _id: req.params.id, societyId }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  const status = statusOf(election);

  if (status === "cancelled") throw new AppError("That election was cancelled.", 409);
  if (status === "completed") throw new AppError("The count is already published.", 409);

  // Publishing a count while people can still vote would end the
  // election early for everyone who had not got to it yet.
  if (status === "scheduled" || status === "open") {
    throw new AppError("Voting is still open.", 409);
  }

  const updated = await Election.findOneAndUpdate(
    { _id: election._id, societyId, closedAt: null },
    { $set: { closedAt: new Date() } },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("The count is already published.", 409);

  const candidates = await ElectionCandidate.find({
    electionId: election._id,
    societyId,
  })
    .populate("userId", "name flatNumber")
    .lean();

  return shapeElection(updated, {
    results: await tally(election._id, societyId, candidates),
  });

};

exports.cancelElection = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const election = await Election.findOne({ _id: req.params.id, societyId }).lean();

  if (!election) throw new AppError("Election not found.", 404);

  if (election.closedAt) {
    throw new AppError("That election is already counted.", 409);
  }

  const updated = await Election.findOneAndUpdate(
    { _id: election._id, societyId, cancelledAt: null },
    { $set: { cancelledAt: new Date() } },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("That election was already cancelled.", 409);

  return shapeElection(updated);

};
