const test = require("node:test");
const assert = require("node:assert");

require("dotenv").config({
  path: require("node:path").join(__dirname, "..", ".env"),
});

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";
process.env.LOG_LEVEL = "silent";

const db = require("./helpers/db");

const skip = !db.isAvailable() && "no MONGO_URI / TEST_MONGO_URI configured";

if (!skip) require("../models/plugins/register");

const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = skip ? null : require("../app");
const { JWT_ISSUER, JWT_AUDIENCE } = skip
  ? {}
  : require("../middleware/authMiddleware");

// =======================================================
// AMENITIES AND ELECTIONS
//
// Both come down to one thing that must not happen twice: two
// residents holding the same hall, and one resident casting two votes
// for the same post.
// =======================================================

const ids = {};

const tokenFor = (user) =>
  jwt.sign(
    {
      id: user._id,
      systemRole: user.systemRole,
      societyRole: user.societyRole,
      societyId: user.societyId,
      tokenVersion: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );

const day = (offset) =>
  new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

const seed = async () => {

  const User = mongoose.model("User");
  const Society = mongoose.model("Society");

  const societyA = new mongoose.Types.ObjectId();
  const societyB = new mongoose.Types.ObjectId();

  await Society.create([
    { _id: societyA, name: "Amen Society A", societyCode: "600001" },
    { _id: societyB, name: "Amen Society B", societyCode: "600002" },
  ]);

  const [resident, neighbour, secretary, guard, outsider] = await User.create([
    { name: "Am Res", email: "am-res@test.com", phone: "9600000001",
      societyId: societyA, flatNumber: "A-101",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Am Nbr", email: "am-nbr@test.com", phone: "9600000002",
      societyId: societyA, flatNumber: "A-102",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Am Sec", email: "am-sec@test.com", phone: "9600000003",
      societyId: societyA, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Am Grd", email: "am-grd@test.com", phone: "9600000004",
      societyId: societyA, societyRole: "security", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Am Out", email: "am-out@test.com", phone: "9600000005",
      societyId: societyB, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
  ]);

  Object.assign(ids, {
    societyA, societyB, resident, neighbour, secretary, guard, outsider,
    tokens: {
      resident: tokenFor(resident),
      neighbour: tokenFor(neighbour),
      secretary: tokenFor(secretary),
      guard: tokenFor(guard),
      outsider: tokenFor(outsider),
    },
  });

};

test.before(async () => {
  if (skip) return;
  await db.connect();
  await db.clear();
  await seed();
});

test.after(async () => {
  if (skip) return;
  await db.disconnect();
});

const as = (who) => ({ Authorization: `Bearer ${ids.tokens[who]}` });


// =======================================================
// AMENITIES
// =======================================================

test("only the committee adds an amenity", { skip }, async () => {

  const refused = await request(app)
    .post("/api/amenities")
    .set(as("resident"))
    .send({ name: "Gym", openTime: "06:00", closeTime: "22:00" });

  assert.equal(refused.status, 403);

  const created = await request(app)
    .post("/api/amenities")
    .set(as("secretary"))
    .send({ name: "Gym", openTime: "06:00", closeTime: "22:00" });

  assert.equal(created.status, 201);

  ids.gym = created.body.data._id;

  const hall = await request(app)
    .post("/api/amenities")
    .set(as("secretary"))
    .send({
      name: "Clubhouse", openTime: "09:00", closeTime: "21:00",
      requiresApproval: true, chargePerHour: 500,
    });

  ids.hall = hall.body.data._id;

});

test("a duplicate name is refused by the index, not a lookup", { skip }, async () => {

  const res = await request(app)
    .post("/api/amenities")
    .set(as("secretary"))
    .send({ name: "Gym" });

  assert.equal(res.status, 409);

});

test("closing before opening is refused", { skip }, async () => {

  const res = await request(app)
    .post("/api/amenities")
    .set(as("secretary"))
    .send({ name: "Backwards", openTime: "22:00", closeTime: "06:00" });

  assert.equal(res.status, 400);

});

test("a malformed time is refused rather than compared as a string", { skip }, async () => {

  for (const openTime of ["9:5", "25:00", "abc", "09:70"]) {
    const res = await request(app)
      .post("/api/amenities")
      .set(as("secretary"))
      .send({ name: `Bad ${openTime}`, openTime });

    assert.equal(res.status, 400, `${openTime} should be refused`);
  }

});

test("a booking outside opening hours is refused", { skip }, async () => {

  const early = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("resident"))
    .send({ date: day(1), startTime: "05:00", endTime: "07:00" });

  assert.equal(early.status, 400);

  const late = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("resident"))
    .send({ date: day(1), startTime: "21:00", endTime: "23:00" });

  assert.equal(late.status, 400);

});

test("a booking in the past is refused", { skip }, async () => {

  const res = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("resident"))
    .send({ date: day(-1), startTime: "09:00", endTime: "10:00" });

  assert.equal(res.status, 400);

});

test("an amenity that needs no approval confirms straight away", { skip }, async () => {

  const res = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("resident"))
    .send({ date: day(1), startTime: "09:00", endTime: "10:00" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "confirmed");

  ids.booking = res.body.data._id;

});

test("two residents cannot hold the same hour", { skip }, async () => {

  const clash = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("neighbour"))
    .send({ date: day(1), startTime: "09:30", endTime: "10:30" });

  assert.equal(clash.status, 409);

});

test("touching at the boundary is not an overlap", { skip }, async () => {

  // 09:00-10:00 and 10:00-11:00 are consecutive, not clashing.
  const res = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("neighbour"))
    .send({ date: day(1), startTime: "10:00", endTime: "11:00" });

  assert.equal(res.status, 201);

});

test("overlap is compared numerically, not as strings", { skip }, async () => {

  const AmenityBooking = mongoose.model("AmenityBooking");

  const booking = await AmenityBooking.findById(ids.booking).lean();

  // The minutes are what the clash query uses. Comparing "09:00"
  // against "10:30" as text only works by accident of zero-padding.
  assert.equal(booking.startMinutes, 540);
  assert.equal(booking.endMinutes, 600);

});

test("an approval-only amenity waits for the committee", { skip }, async () => {

  const res = await request(app)
    .post(`/api/amenities/${ids.hall}/bookings`)
    .set(as("resident"))
    .send({ date: day(2), startTime: "18:00", endTime: "21:00", purpose: "Birthday" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "pending");

  ids.pending = res.body.data._id;

});

test("the pending queue is the committee's", { skip }, async () => {

  const resident = await request(app)
    .get("/api/amenities/bookings/pending")
    .set(as("resident"));

  assert.equal(resident.status, 403);

  const secretary = await request(app)
    .get("/api/amenities/bookings/pending")
    .set(as("secretary"));

  assert.equal(secretary.body.data.length, 1);
  assert.equal(secretary.body.data[0].flatNumber, "A-101");

});

test("approving a booking that now clashes is refused", { skip }, async () => {

  // A second request for the same slot, also pending.
  const second = await request(app)
    .post(`/api/amenities/${ids.hall}/bookings`)
    .set(as("neighbour"))
    .send({ date: day(2), startTime: "19:00", endTime: "20:00" });

  assert.equal(second.status, 409, "even pending holds the slot");

});

test("a confirmed booking cannot be double-approved into a clash", { skip }, async () => {

  const first = await request(app)
    .patch(`/api/amenities/bookings/${ids.pending}/decision`)
    .set(as("secretary"))
    .send({ status: "confirmed" });

  assert.equal(first.status, 200);
  assert.equal(first.body.data.status, "confirmed");

  const again = await request(app)
    .patch(`/api/amenities/bookings/${ids.pending}/decision`)
    .set(as("secretary"))
    .send({ status: "confirmed" });

  assert.equal(again.status, 404, "it is no longer pending");

});

test("a resident cancels their own booking, not a neighbour's", { skip }, async () => {

  const theirs = await request(app)
    .delete(`/api/amenities/bookings/${ids.booking}`)
    .set(as("neighbour"));

  assert.equal(theirs.status, 403);

  const mine = await request(app)
    .delete(`/api/amenities/bookings/${ids.booking}`)
    .set(as("resident"));

  assert.equal(mine.status, 200);

});

test("a cancelled slot frees up again", { skip }, async () => {

  const res = await request(app)
    .post(`/api/amenities/${ids.gym}/bookings`)
    .set(as("neighbour"))
    .send({ date: day(1), startTime: "09:00", endTime: "10:00" });

  assert.equal(res.status, 201);

});

test("an amenity with bookings refuses deletion", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/amenities/${ids.gym}`)
    .set(as("secretary"));

  assert.equal(res.status, 409);

});

test("the day view marks the caller's own rows", { skip }, async () => {

  const res = await request(app)
    .get(`/api/amenities/${ids.gym}/bookings?date=${day(1)}`)
    .set(as("neighbour"));

  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((b) => b.isMine === true));

  const other = await request(app)
    .get(`/api/amenities/${ids.gym}/bookings?date=${day(1)}`)
    .set(as("resident"));

  assert.ok(other.body.data.every((b) => b.isMine === false));

});

test("another society sees none of this", { skip }, async () => {

  const res = await request(app).get("/api/amenities").set(as("outsider"));

  assert.equal(res.body.data.length, 0);

});


// =======================================================
// ELECTIONS
// =======================================================

test("only the committee schedules an election", { skip }, async () => {

  const refused = await request(app)
    .post("/api/elections")
    .set(as("resident"))
    .send({
      title: "Rigged", posts: [{ post: "chairman", seats: 1 }],
      opensAt: day(1), closesAt: day(5),
    });

  assert.equal(refused.status, 403);

});

test("an election and its candidates land together", { skip }, async () => {

  const res = await request(app)
    .post("/api/elections")
    .set(as("secretary"))
    .send({
      title: "Committee 2026",
      description: "Annual election",
      posts: [{ post: "chairman", seats: 1 }, { post: "committee_member", seats: 2 }],
      opensAt: new Date(Date.now() + 3600_000),
      closesAt: new Date(Date.now() + 5 * 86400_000),
      candidates: [
        { post: "chairman", userId: String(ids.resident._id), statement: "Steady hands" },
        { post: "chairman", userId: String(ids.neighbour._id), statement: "Fresh start" },
      ],
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "scheduled");

  ids.election = res.body.data._id;

  const detail = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("resident"));

  assert.equal(detail.body.data.candidates.length, 2);

});

test("a candidate who does not live here fails the whole create", { skip }, async () => {

  const before = await mongoose.model("Election").countDocuments({ societyId: ids.societyA });

  const res = await request(app)
    .post("/api/elections")
    .set(as("secretary"))
    .send({
      title: "Bad Slate",
      posts: [{ post: "treasurer", seats: 1 }],
      opensAt: day(1),
      closesAt: day(5),
      candidates: [{ post: "treasurer", userId: String(ids.outsider._id) }],
    });

  assert.equal(res.status, 400);

  const after = await mongoose.model("Election").countDocuments({ societyId: ids.societyA });

  assert.equal(after, before, "the election must not survive its own candidates failing");

});

test("a duplicate post in one election is refused", { skip }, async () => {

  const res = await request(app)
    .post("/api/elections")
    .set(as("secretary"))
    .send({
      title: "Twice",
      posts: [{ post: "chairman", seats: 1 }, { post: "chairman", seats: 1 }],
      opensAt: day(1), closesAt: day(5),
    });

  assert.equal(res.status, 400);

});

test("closing before opening is refused", { skip }, async () => {

  const res = await request(app)
    .post("/api/elections")
    .set(as("secretary"))
    .send({
      title: "Backwards",
      posts: [{ post: "secretary", seats: 1 }],
      opensAt: day(5), closesAt: day(1),
    });

  assert.equal(res.status, 400);

});

test("voting before it opens is refused", { skip }, async () => {

  const detail = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("resident"));

  const candidate = detail.body.data.candidates[0];

  ids.candidateA = candidate._id;
  ids.candidateB = detail.body.data.candidates[1]._id;

  const res = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("resident"))
    .send({ candidateId: ids.candidateA });

  assert.equal(res.status, 409);

});

test("the ballot is fixed once voting opens", { skip }, async () => {

  // Wind the opening back so it is live.
  await mongoose.model("Election").updateOne(
    { _id: ids.election },
    { $set: { opensAt: new Date(Date.now() - 3600_000) } }
  );

  const res = await request(app)
    .post(`/api/elections/${ids.election}/candidates`)
    .set(as("secretary"))
    .send({ post: "chairman", userId: String(ids.secretary._id) });

  assert.equal(res.status, 409, "residents who already voted never saw them");

});

test("one vote per resident per post, enforced by the index", { skip }, async () => {

  const first = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("resident"))
    .send({ candidateId: ids.candidateA });

  assert.equal(first.status, 201);

  // Voting again, even for the other candidate, is the same post.
  const second = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("resident"))
    .send({ candidateId: ids.candidateB });

  assert.equal(second.status, 409);

  const votes = await mongoose.model("ElectionVote")
    .countDocuments({ electionId: ids.election, voterId: ids.resident._id });

  assert.equal(votes, 1);

});

test("the post comes from the candidate, not the body", { skip }, async () => {

  // Claiming a different post would otherwise buy a second vote.
  const res = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("resident"))
    .send({ candidateId: ids.candidateB, post: "committee_member" });

  assert.equal(res.status, 409, "still the chairman vote they already cast");

});

test("a guard does not vote in a resident election", { skip }, async () => {

  const res = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("guard"))
    .send({ candidateId: ids.candidateA });

  assert.equal(res.status, 403);

});

test("no count is visible while voting is open", { skip }, async () => {

  const res = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("resident"));

  assert.equal(res.body.data.status, "open");
  assert.equal(res.body.data.results, undefined, "a running tally would change votes");
  assert.deepEqual(res.body.data.myVotedPosts, ["chairman"]);

});

test("publishing a count while voting is open is refused", { skip }, async () => {

  const res = await request(app)
    .post(`/api/elections/${ids.election}/close`)
    .set(as("secretary"));

  assert.equal(res.status, 409);

});

test("once voting ends it awaits a count, then publishes one", { skip }, async () => {

  await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("neighbour"))
    .send({ candidateId: ids.candidateA });

  await mongoose.model("Election").updateOne(
    { _id: ids.election },
    { $set: { closesAt: new Date(Date.now() - 1000) } }
  );

  const awaiting = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("resident"));

  assert.equal(awaiting.body.data.status, "awaiting_count");
  assert.equal(awaiting.body.data.results, undefined);

  const closed = await request(app)
    .post(`/api/elections/${ids.election}/close`)
    .set(as("secretary"));

  assert.equal(closed.status, 200);
  assert.equal(closed.body.data.status, "completed");

  const chairman = closed.body.data.results.chairman;

  assert.equal(chairman[0].votes, 2, "highest first");
  assert.equal(chairman[1].votes, 0);

});

test("turnout counts voters, not ballots", { skip }, async () => {

  const res = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("resident"));

  // Two of three eligible residents voted. The guard is staff and is
  // not counted as eligible.
  assert.equal(res.body.data.turnout, 67);

});

test("a counted election cannot be cancelled or recounted", { skip }, async () => {

  const cancel = await request(app)
    .patch(`/api/elections/${ids.election}/cancel`)
    .set(as("secretary"));

  assert.equal(cancel.status, 409);

  const recount = await request(app)
    .post(`/api/elections/${ids.election}/close`)
    .set(as("secretary"));

  assert.equal(recount.status, 409);

});

test("voting is refused once the result is out", { skip }, async () => {

  const res = await request(app)
    .post(`/api/elections/${ids.election}/vote`)
    .set(as("secretary"))
    .send({ candidateId: ids.candidateA });

  assert.equal(res.status, 409);

});

test("another society's election is not reachable", { skip }, async () => {

  const res = await request(app)
    .get(`/api/elections/${ids.election}`)
    .set(as("outsider"));

  assert.equal(res.status, 404);

});


// =======================================================
// THE SOCIETY MAP
// =======================================================

test("a pin resolves its catalogue entry and clamps its position", { skip }, async () => {

  const service = await mongoose.model("Service").create({
    name: "Corner Store", category: "others", phone: "9876500001",
  });

  const added = await request(app)
    .post("/api/map")
    .set(as("secretary"))
    .send({
      serviceId: String(service._id),
      mapPosition: { x: 250, y: -30 },
      customName: "Gate 1 Kirana",
    });

  assert.equal(added.status, 201);
  assert.equal(added.body.data.name, "Gate 1 Kirana", "the local name wins");
  // Percentages of the plan — anything outside would render off it.
  assert.equal(added.body.data.mapPosition.x, 100);
  assert.equal(added.body.data.mapPosition.y, 0);

  ids.pin = added.body.data._id;
  ids.service = service._id;

});

test("the catalogue marks what is already placed", { skip }, async () => {

  const res = await request(app).get("/api/map/catalog").set(as("secretary"));

  assert.equal(res.status, 200);

  const entry = res.body.data.find((s) => String(s._id) === String(ids.service));

  assert.equal(entry.isPlaced, true);

});

test("a resident cannot move a pin", { skip }, async () => {

  const res = await request(app)
    .patch(`/api/map/${ids.pin}`)
    .set(as("resident"))
    .send({ mapPosition: { x: 10, y: 10 } });

  assert.equal(res.status, 403);

});

test("removing a pin leaves the catalogue entry alone", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/map/${ids.pin}`)
    .set(as("secretary"));

  assert.equal(res.status, 200);

  const service = await mongoose.model("Service").findById(ids.service).lean();

  assert.ok(service, "other societies are still using it");

});


// =======================================================
// BROWSER PUSH
// =======================================================

test("the VAPID key is readable without a token", { skip }, async () => {

  const res = await request(app).get("/api/users/web-push-key");

  assert.equal(res.status, 200);
  // The web client reads it off the top level, not out of `data`.
  assert.ok("key" in res.body);

});

test("a browser subscription moves with whoever signs in", { skip }, async () => {

  const subscription = {
    endpoint: "https://push.example.com/shared-browser",
    keys: { p256dh: "key", auth: "auth" },
  };

  await request(app)
    .post("/api/users/me/web-push")
    .set(as("resident"))
    .send({ subscription });

  await request(app)
    .post("/api/users/me/web-push")
    .set(as("neighbour"))
    .send({ subscription });

  const User = mongoose.model("User");

  const first = await User.findById(ids.resident._id).select("webPushSubscriptions").lean();
  const second = await User.findById(ids.neighbour._id).select("webPushSubscriptions").lean();

  assert.equal(first.webPushSubscriptions.length, 0, "the previous user must stop receiving");
  assert.equal(second.webPushSubscriptions.length, 1);

  const removed = await request(app)
    .delete("/api/users/me/web-push")
    .set(as("neighbour"))
    .send({ endpoint: subscription.endpoint });

  assert.equal(removed.status, 200);

});
