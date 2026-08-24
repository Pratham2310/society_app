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

if (!skip) {
  require("../models/plugins/register");
}

const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = skip ? null : require("../app");
const { JWT_ISSUER, JWT_AUDIENCE } = skip ? {} : require("../middleware/authMiddleware");

// =======================================================
// RESIDENT LIFECYCLE
//
// A flat is claimed the moment someone registers for it. Every path
// out of that claim has to hand the flat back, or the real occupant
// can never register and nothing in the UI can fix it.
// =======================================================

let counter = 0;
const unique = () => `${Date.now()}${counter++}`;

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

const ctx = {};

test.before(async () => {

  if (skip) return;

  await db.connect();
  await db.clear();

  const Society = mongoose.model("Society");
  const Wing = mongoose.model("Wing");
  const Flat = mongoose.model("Flat");
  const User = mongoose.model("User");

  const society = await Society.create({
    name: "Lifecycle Society", societyCode: "700001", city: "Nashik",
  });

  const wing = await Wing.create({
    societyId: society._id, name: "A", totalFloors: 2, flatsPerFloor: 8,
  });

  const flats = [];
  for (let floor = 1; floor <= 2; floor += 1) {
    for (let i = 1; i <= 8; i += 1) {
      flats.push({
        societyId: society._id, wingId: wing._id, floor,
        flatNumber: `${floor}0${i}`, isOccupied: false,
      });
    }
  }
  await Flat.insertMany(flats);

  const [secretary, committee, member] = await User.create([
    { name: "Sec", email: `sec${unique()}@test.com`, phone: "9700000001",
      societyId: society._id, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Committee", email: `com${unique()}@test.com`, phone: "9700000002",
      societyId: society._id, societyRole: "committee_member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Ordinary", email: `mem${unique()}@test.com`, phone: "9700000003",
      societyId: society._id, societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
  ]);

  Object.assign(ctx, { society, wing, secretary, committee, member });

});

test.after(async () => {
  if (skip) return;
  await db.disconnect();
});


/** A resident sitting in a flat, pending approval — what registration produces. */
const pendingResident = async (flatNumber, label = "Applicant") => {

  const Flat = mongoose.model("Flat");
  const User = mongoose.model("User");

  const flat = await Flat.findOneAndUpdate(
    { societyId: ctx.society._id, flatNumber, isOccupied: false },
    { $set: { isOccupied: true } },
    { new: true }
  );

  assert.ok(flat, `flat ${flatNumber} should have been free`);

  return User.create({
    name: label,
    email: `${label.replace(/\s/g, "").toLowerCase()}${unique()}@test.com`,
    phone: String(9710000000 + counter).slice(0, 10),
    societyId: ctx.society._id,
    wingId: ctx.wing._id,
    flatId: flat._id,
    flatNumber,
    societyRole: "member",
    systemRole: "user",
    status: "pending",
    isVerified: false,
  });

};

const flatIsOccupied = async (flatNumber) => {
  const flat = await mongoose.model("Flat")
    .findOne({ societyId: ctx.society._id, flatNumber }).lean();
  return flat.isOccupied;
};


// =======================================================
// APPROVAL GATE
// =======================================================

test("a pending resident cannot sign in", { skip }, async () => {

  const resident = await pendingResident("101", "Pending Person");

  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: resident.email, password: "irrelevant" });

  assert.ok(res.status >= 400, "an unapproved account must not get a token");
  assert.ok(!res.body?.data?.token, "and definitely no token");

});


test("approving keeps the flat and lets them in", { skip }, async () => {

  const resident = await pendingResident("102", "Approved Person");

  const res = await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "approved" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const after = await mongoose.model("User").findById(resident._id).lean();

  assert.strictEqual(after.status, "approved");
  assert.strictEqual(after.isVerified, true);
  assert.strictEqual(after.flatNumber, "102", "they keep the flat");
  assert.strictEqual(await flatIsOccupied("102"), true, "which stays occupied");

});


test("declining hands the flat back", { skip }, async () => {

  const resident = await pendingResident("103", "Wrong Flat Person");

  assert.strictEqual(await flatIsOccupied("103"), true, "claimed on registration");

  const res = await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "rejected" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  // Without this the flat is held forever and the real occupant can
  // never register — with nothing in the UI able to fix it.
  assert.strictEqual(
    await flatIsOccupied("103"),
    false,
    "declining must free the flat"
  );

  const after = await mongoose.model("User").findById(resident._id).lean();

  assert.strictEqual(after.status, "rejected");
  assert.ok(!after.flatId, "and unlink it from the account");

});


test("the freed flat can be claimed by the next person", { skip }, async () => {

  const first = await pendingResident("104", "First Try");

  await request(app)
    .put(`/api/v1/users/update-status/${first._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "rejected" });

  // The point of freeing it.
  const second = await pendingResident("104", "Rightful Occupant");

  assert.strictEqual(second.flatNumber, "104");
  assert.strictEqual(await flatIsOccupied("104"), true);

});


test("any committee member can clear the queue, not only the secretary", { skip }, async () => {

  const resident = await pendingResident("201", "Committee Approved");

  // Approvals stall if one person is the only one who can do this.
  const res = await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.committee)}`)
    .send({ status: "approved" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

});


test("an ordinary resident cannot approve anyone", { skip }, async () => {

  const resident = await pendingResident("202", "Not Their Call");

  const res = await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.member)}`)
    .send({ status: "approved" });

  assert.strictEqual(res.status, 403);

});


// =======================================================
// FIXING A WRONG FLAT AFTER APPROVAL
// =======================================================

test("an approved resident can be moved, freeing the old flat", { skip }, async () => {

  const resident = await pendingResident("203", "Moves House");

  await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "approved" });

  const res = await request(app)
    .put(`/api/v1/users/reassign-flat/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ wingId: String(ctx.wing._id), flatNumber: "204" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  assert.strictEqual(await flatIsOccupied("203"), false, "old flat released");
  assert.strictEqual(await flatIsOccupied("204"), true, "new flat claimed");

  const after = await mongoose.model("User").findById(resident._id).lean();
  assert.strictEqual(after.flatNumber, "204");

});


test("moving someone into an occupied flat changes nothing", { skip }, async () => {

  const sitting = await pendingResident("205", "Already Here");
  const mover = await pendingResident("206", "Wants 205");

  for (const person of [sitting, mover]) {
    await request(app)
      .put(`/api/v1/users/update-status/${person._id}`)
      .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
      .send({ status: "approved" });
  }

  const res = await request(app)
    .put(`/api/v1/users/reassign-flat/${mover._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ wingId: String(ctx.wing._id), flatNumber: "205" });

  assert.strictEqual(res.status, 409, "the flat is taken");

  // The new flat is claimed before the old one is released, so a
  // refusal must leave the mover exactly where they were.
  assert.strictEqual(await flatIsOccupied("206"), true, "they keep their own flat");

  const after = await mongoose.model("User").findById(mover._id).lean();
  assert.strictEqual(after.flatNumber, "206");

});


test("removing a resident frees their flat", { skip }, async () => {

  const resident = await pendingResident("207", "Moved Out");

  await request(app)
    .put(`/api/v1/users/update-status/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "approved" });

  const res = await request(app)
    .delete(`/api/v1/users/resident/${resident._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`);

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  assert.strictEqual(await flatIsOccupied("207"), false);
  assert.strictEqual(await mongoose.model("User").findById(resident._id), null);

});


test("the secretary cannot be removed while they hold the role", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/v1/users/resident/${ctx.secretary._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.committee)}`);

  // Removing them would leave nobody able to approve anyone.
  assert.strictEqual(res.status, 409);
  assert.match(res.body.message, /secretary role/i);

});


test("a committee member cannot remove their own account", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/v1/users/resident/${ctx.committee._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.committee)}`);

  assert.strictEqual(res.status, 400);

});


test("a committee member cannot touch another society", { skip }, async () => {

  const Society = mongoose.model("Society");
  const User = mongoose.model("User");

  const other = await Society.create({
    name: "Other Society", societyCode: "700002", city: "Pune",
  });

  const outsider = await User.create({
    name: "Elsewhere", email: `elsewhere${unique()}@test.com`, phone: "9720000001",
    societyId: other._id, societyRole: "member", systemRole: "user",
    status: "pending", isVerified: false,
  });

  const res = await request(app)
    .put(`/api/v1/users/update-status/${outsider._id}`)
    .set("Authorization", `Bearer ${tokenFor(ctx.secretary)}`)
    .send({ status: "approved" });

  assert.ok(res.status === 403 || res.status === 404, "cross-society is refused");

  const after = await User.findById(outsider._id).lean();
  assert.strictEqual(after.status, "pending", "and nothing changed");

});
