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
// THE SIGNED-IN USER
//
// The app reads /users/me on every launch and gates every admin
// control on /users/me/permissions, so both are load-bearing in a way
// that a shape change would break quietly.
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

const seed = async () => {

  const User = mongoose.model("User");
  const Society = mongoose.model("Society");
  const Wing = mongoose.model("Wing");
  const Flat = mongoose.model("Flat");

  const societyA = new mongoose.Types.ObjectId();
  const societyB = new mongoose.Types.ObjectId();

  await Society.create([
    { _id: societyA, name: "Me Society A", societyCode: "200001" },
    { _id: societyB, name: "Me Society B", societyCode: "200002" },
  ]);

  const wing = await Wing.create({
    societyId: societyA, name: "A", totalFloors: 3, flatsPerFloor: 4,
  });

  const flat = await Flat.create({
    societyId: societyA, wingId: wing._id, flatNumber: "A-101", floor: 1,
  });

  const [resident, secretary, treasurer, guard, otherResident] =
    await User.create([
      { name: "Res One", email: "me-res@test.com", phone: "9200000001",
        societyId: societyA, wingId: wing._id, flatId: flat._id,
        societyRole: "member", systemRole: "user",
        status: "approved", isVerified: true,
        occupancyType: "owner", livingType: "family", familySize: 3 },
      { name: "Sec One", email: "me-sec@test.com", phone: "9200000002",
        societyId: societyA, societyRole: "secretary", systemRole: "user",
        status: "approved", isVerified: true },
      { name: "Tre One", email: "me-tre@test.com", phone: "9200000003",
        societyId: societyA, societyRole: "treasurer", systemRole: "user",
        status: "approved", isVerified: true },
      { name: "Gua One", email: "me-gua@test.com", phone: "9200000004",
        societyId: societyA, societyRole: "security", systemRole: "user",
        status: "approved", isVerified: true },
      { name: "Res Two", email: "me-res2@test.com", phone: "9200000005",
        societyId: societyB, societyRole: "member", systemRole: "user",
        status: "approved", isVerified: true },
    ]);

  Object.assign(ids, {
    societyA, societyB, wing, flat,
    resident, secretary, treasurer, guard, otherResident,
    tokens: {
      resident: tokenFor(resident),
      secretary: tokenFor(secretary),
      treasurer: tokenFor(treasurer),
      guard: tokenFor(guard),
      otherResident: tokenFor(otherResident),
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
// PROFILE
// =======================================================

test("GET /users/me returns the shape the app reads", { skip }, async () => {

  const res = await request(app).get("/api/users/me").set(as("resident"));

  assert.equal(res.status, 200);

  const me = res.body.data;

  // These field names are read directly by the app's UserProfile.
  for (const field of [
    "_id", "name", "email", "phone", "systemRole", "societyRole",
    "societyId", "status", "isVerified", "avatar", "flatNumber",
  ]) {
    assert.ok(field in me, `${field} is missing from /users/me`);
  }

  // flatNumber has to resolve through the populated flat, not just the
  // denormalised copy — the resident was seeded with only flatId.
  assert.equal(me.flatNumber, "A-101");
  assert.equal(me.wingName, "A");

});

test("GET /users/me never leaks credentials", { skip }, async () => {

  const res = await request(app).get("/api/users/me").set(as("resident"));

  for (const secret of ["password", "otpHash", "otpAttempts", "tokenVersion"]) {
    assert.ok(
      !(secret in res.body.data),
      `${secret} must never reach a client`
    );
  }

});

test("a resident cannot read anyone else through /me", { skip }, async () => {

  // There is no id to substitute — that is the point of the route.
  const mine = await request(app).get("/api/users/me").set(as("resident"));
  const theirs = await request(app).get("/api/users/me").set(as("otherResident"));

  assert.notEqual(String(mine.body.data._id), String(theirs.body.data._id));
  assert.notEqual(String(mine.body.data.societyId), String(theirs.body.data.societyId));

});


// =======================================================
// PERMISSIONS
// =======================================================

test("permissions follow the role, not the token", { skip }, async () => {

  const res = await request(app)
    .get("/api/users/me/permissions")
    .set(as("resident"));

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.permissions, ["members.view"]);

  // Promote them in the database without reissuing the token. A mobile
  // session lasts 30 days; a role change has to take effect before it
  // expires.
  await mongoose.model("User").updateOne(
    { _id: ids.resident._id },
    { $set: { societyRole: "treasurer" } }
  );

  const after = await request(app)
    .get("/api/users/me/permissions")
    .set(as("resident"));

  assert.ok(after.body.data.permissions.includes("finance.manage"));

  await mongoose.model("User").updateOne(
    { _id: ids.resident._id },
    { $set: { societyRole: "member" } }
  );

});

test("a guard holds the gate and nothing else", { skip }, async () => {

  const res = await request(app)
    .get("/api/users/me/permissions")
    .set(as("guard"));

  assert.deepEqual(res.body.data.permissions, ["security.gate"]);

});


// =======================================================
// PROFILE CHANGES GO TO THE SECRETARY
// =======================================================

test("editing a profile does not write it", { skip }, async () => {

  const res = await request(app)
    .put("/api/users/me/profile")
    .set(as("resident"))
    .send({ name: "Renamed Resident", familySize: 5 });

  assert.equal(res.status, 202);

  const stored = await mongoose.model("User")
    .findById(ids.resident._id).select("name familySize").lean();

  assert.equal(stored.name, "Res One", "the write must wait for approval");
  assert.equal(stored.familySize, 3);

});

test("a second edit replaces the first rather than queueing", { skip }, async () => {

  await request(app)
    .put("/api/users/me/profile")
    .set(as("resident"))
    .send({ name: "Third Name" });

  const pending = await mongoose.model("ProfileChangeRequest")
    .find({ userId: ids.resident._id, status: "pending" }).lean();

  assert.equal(pending.length, 1, "one open request per resident");
  assert.equal(pending[0].requested.name, "Third Name");

});

test("submitting an unchanged form raises nothing", { skip }, async () => {

  const res = await request(app)
    .put("/api/users/me/profile")
    .set(as("resident"))
    .send({ name: "Res One" });

  assert.equal(res.status, 400);

});

test("the secretary sees the queue; a resident does not", { skip }, async () => {

  const secretary = await request(app)
    .get("/api/users/profile-change-requests")
    .set(as("secretary"));

  assert.equal(secretary.status, 200);
  assert.equal(secretary.body.data.length, 1);

  const resident = await request(app)
    .get("/api/users/profile-change-requests")
    .set(as("resident"));

  assert.equal(resident.status, 403);

});

test("a treasurer cannot approve members", { skip }, async () => {

  // finance.manage is not members.approve — the permission guard has to
  // distinguish them, or every committee role becomes equivalent.
  const res = await request(app)
    .get("/api/users/profile-change-requests")
    .set(as("treasurer"));

  assert.equal(res.status, 403);

});

test("approving applies only the requested fields", { skip }, async () => {

  const res = await request(app)
    .put(`/api/users/profile-change-requests/${ids.resident._id}`)
    .set(as("secretary"))
    .send({ approve: true });

  assert.equal(res.status, 200);

  const stored = await mongoose.model("User")
    .findById(ids.resident._id).select("name familySize occupancyType").lean();

  assert.equal(stored.name, "Third Name");
  // familySize was in an earlier, replaced request; it must not resurface.
  assert.equal(stored.familySize, 3);
  assert.equal(stored.occupancyType, "owner", "untouched fields stay put");

});

test("a secretary cannot decide another society's request", { skip }, async () => {

  await request(app)
    .put("/api/users/me/profile")
    .set(as("otherResident"))
    .send({ name: "Elsewhere" });

  const res = await request(app)
    .put(`/api/users/profile-change-requests/${ids.otherResident._id}`)
    .set(as("secretary"))
    .send({ approve: true });

  assert.equal(res.status, 404);

  const stored = await mongoose.model("User")
    .findById(ids.otherResident._id).select("name").lean();

  assert.equal(stored.name, "Res Two", "the write must not have happened");

});

test("rejecting requires a reason", { skip }, async () => {

  const res = await request(app)
    .put(`/api/users/profile-change-requests/${ids.otherResident._id}`)
    .set(as("otherResident"))
    .send({ approve: false });

  // otherResident is a member, so this is a permission failure before
  // it is a validation one.
  assert.equal(res.status, 403);

});


// =======================================================
// VEHICLES
// =======================================================

test("a vehicle round-trips and rejects a duplicate plate", { skip }, async () => {

  const added = await request(app)
    .post("/api/users/me/vehicles")
    .set(as("resident"))
    .send({ type: "car", number: "mh15 ab 1234", parkingSlot: "B-12" });

  assert.equal(added.status, 201);
  assert.equal(added.body.data.number, "MH15 AB 1234", "plates are normalised");

  const duplicate = await request(app)
    .post("/api/users/me/vehicles")
    .set(as("resident"))
    .send({ type: "bike", number: "MH15 AB 1234" });

  assert.equal(duplicate.status, 409);

  const list = await request(app)
    .get("/api/users/me/vehicles")
    .set(as("resident"));

  assert.equal(list.body.data.length, 1);

  const removed = await request(app)
    .delete(`/api/users/me/vehicles/${list.body.data[0]._id}`)
    .set(as("resident"));

  assert.equal(removed.status, 200);

  const after = await request(app)
    .get("/api/users/me/vehicles")
    .set(as("resident"));

  assert.equal(after.body.data.length, 0);

});


// =======================================================
// PUSH TOKENS
// =======================================================

test("a shared device moves with whoever signs in", { skip }, async () => {

  const token = "ExponentPushToken[shared-tablet]";

  await request(app)
    .post("/api/users/me/push-token")
    .set(as("guard"))
    .send({ token, platform: "android" });

  // Next shift, a different guard signs in on the same tablet.
  await request(app)
    .post("/api/users/me/push-token")
    .set(as("secretary"))
    .send({ token, platform: "android" });

  const User = mongoose.model("User");

  const first = await User.findById(ids.guard._id).select("pushTokens").lean();
  const second = await User.findById(ids.secretary._id).select("pushTokens").lean();

  assert.equal(
    first.pushTokens.length, 0,
    "the previous holder must stop receiving that device's alerts"
  );
  assert.equal(second.pushTokens.length, 1);

});

test("registering the same token twice does not duplicate it", { skip }, async () => {

  const token = "ExponentPushToken[steady-phone]";

  for (let i = 0; i < 3; i += 1) {
    await request(app)
      .post("/api/users/me/push-token")
      .set(as("resident"))
      .send({ token, platform: "ios" });
  }

  const user = await mongoose.model("User")
    .findById(ids.resident._id).select("pushTokens").lean();

  assert.equal(user.pushTokens.filter((t) => t.token === token).length, 1);

});


// =======================================================
// THE CALLER'S SOCIETY
// =======================================================

test("a resident reads their own society, not one they name", { skip }, async () => {

  const res = await request(app).get("/api/societies/me").set(as("resident"));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.name, "Me Society A");

  const other = await request(app).get("/api/societies/me").set(as("otherResident"));

  assert.equal(other.body.data.name, "Me Society B");

});

test("only finance roles set the payment details", { skip }, async () => {

  const refused = await request(app)
    .put("/api/societies/me/payment")
    .set(as("resident"))
    .send({ upiId: "attacker@upi" });

  assert.equal(refused.status, 403);

  const allowed = await request(app)
    .put("/api/societies/me/payment")
    .set(as("treasurer"))
    .send({ upiId: "society@upi", payeeName: "Me Society A" });

  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.data.payment.upiId, "society@upi");

});

test("payment details cannot be set on another society", { skip }, async () => {

  // The route takes no id, so the only society reachable is the one in
  // the token. Society B must be untouched by A's treasurer.
  const societyB = await mongoose.model("Society")
    .findById(ids.societyB).lean();

  assert.ok(
    !societyB.payment?.upiId,
    "another society's payee must not have been written"
  );

});
