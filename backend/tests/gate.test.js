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
// THE GATE
//
// A pass is a lookup key, not a credential. Most of what follows is
// about what happens when someone presents one that is expired,
// foreign, already used, or not theirs.
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

  const societyA = new mongoose.Types.ObjectId();
  const societyB = new mongoose.Types.ObjectId();

  await Society.create([
    { _id: societyA, name: "Gate Society A", societyCode: "500001" },
    { _id: societyB, name: "Gate Society B", societyCode: "500002" },
  ]);

  const [resident, neighbour, guard, secretary, guardB] = await User.create([
    { name: "Gate Res", email: "gate-res@test.com", phone: "9500000001",
      societyId: societyA, flatNumber: "A-101",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Gate Nbr", email: "gate-nbr@test.com", phone: "9500000002",
      societyId: societyA, flatNumber: "A-102",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Gate Grd", email: "gate-grd@test.com", phone: "9500000003",
      societyId: societyA, societyRole: "security", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Gate Sec", email: "gate-sec@test.com", phone: "9500000004",
      societyId: societyA, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Gate GrdB", email: "gate-grdb@test.com", phone: "9500000005",
      societyId: societyB, societyRole: "security", systemRole: "user",
      status: "approved", isVerified: true },
  ]);

  Object.assign(ids, {
    societyA, societyB, resident, neighbour, guard, secretary, guardB,
    tokens: {
      resident: tokenFor(resident),
      neighbour: tokenFor(neighbour),
      guard: tokenFor(guard),
      secretary: tokenFor(secretary),
      guardB: tokenFor(guardB),
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
// RESIDENT STATUS
// =======================================================

test("the app's vocabulary maps onto the stored one", { skip }, async () => {

  const res = await request(app)
    .patch("/api/security/status/me")
    .set(as("resident"))
    .send({ status: "dnd", durationMinutes: 60, instruction: "Ring the bell twice" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "dnd");
  assert.ok(res.body.data.expiresAt, "a timed status has an expiry");

  const stored = await mongoose.model("ResidentSecurityStatus")
    .findOne({ residentId: ids.resident._id }).lean();

  assert.equal(stored.status, "do_not_disturb", "stored under the older name");

});

test("'until I change it' leaves no expiry", { skip }, async () => {

  const res = await request(app)
    .patch("/api/security/status/me")
    .set(as("resident"))
    .send({ status: "away", durationMinutes: 0 });

  assert.equal(res.body.data.expiresAt, null);

});

test("a lapsed status reads as safe without being rewritten", { skip }, async () => {

  await mongoose.model("ResidentSecurityStatus").updateOne(
    { residentId: ids.resident._id },
    { $set: { status: "away", expiresAt: new Date(Date.now() - 1000) } }
  );

  const res = await request(app)
    .get("/api/security/status/me")
    .set(as("resident"));

  assert.equal(res.body.data.status, "safe");

  // A GET must not write. The record still says away; only the reading
  // of it changed.
  const stored = await mongoose.model("ResidentSecurityStatus")
    .findOne({ residentId: ids.resident._id }).lean();

  assert.equal(stored.status, "away");

});

test("an unknown status is refused", { skip }, async () => {

  const res = await request(app)
    .patch("/api/security/status/me")
    .set(as("resident"))
    .send({ status: "invisible" });

  assert.equal(res.status, 400);

});


// =======================================================
// PANIC
// =======================================================

test("panic raises an alert the guard can acknowledge", { skip }, async () => {

  const raised = await request(app)
    .post("/api/security/status/panic")
    .set(as("resident"))
    .send({});

  assert.equal(raised.status, 201);
  assert.equal(raised.body.data.status, "active");

  ids.alert = raised.body.data._id;

  const ack = await request(app)
    .patch(`/api/security/alerts/${ids.alert}/acknowledge`)
    .set(as("guard"));

  assert.equal(ack.status, 200);
  assert.equal(ack.body.data.status, "acknowledged");

  // Acknowledging is not resolving — the resident wants to know
  // somebody is coming before it is closed.
  assert.notEqual(ack.body.data.status, "resolved");

});

test("a resident cannot acknowledge their own alert", { skip }, async () => {

  const raised = await request(app)
    .post("/api/security/status/panic")
    .set(as("neighbour"))
    .send({});

  const res = await request(app)
    .patch(`/api/security/alerts/${raised.body.data._id}/acknowledge`)
    .set(as("neighbour"));

  assert.equal(res.status, 403);

});

test("marking safe closes the resident's own alerts only", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/status/safe")
    .set(as("resident"))
    .send({});

  assert.equal(res.status, 200);
  assert.ok(res.body.data.resolved >= 1);

  const neighbours = await mongoose.model("SecurityAlert")
    .find({ residentId: ids.neighbour._id, status: { $ne: "resolved" } }).lean();

  assert.equal(neighbours.length, 1, "another flat's alert must stay open");

});


// =======================================================
// VISITOR PASSES
// =======================================================

test("a resident's own pass is pre-approved; a guard's walk-up is not", { skip }, async () => {

  const mine = await request(app)
    .post("/api/security/visitors")
    .set(as("resident"))
    .send({ name: "Anita Rao", phone: "9123456780", purpose: "guest", validHours: 4 });

  assert.equal(mine.status, 201);
  assert.equal(mine.body.data.status, "approved", "the resident is expecting them");
  assert.ok(mine.body.data.passCode, "a pass has a readable code");
  assert.ok(mine.body.data.qr, "and a scannable one");

  ids.visitor = mine.body.data._id;
  ids.passCode = mine.body.data.passCode;

  const walkUp = await request(app)
    .post("/api/security/visitors")
    .set(as("guard"))
    .send({
      name: "Courier", phone: "9123456781", purpose: "delivery",
      residentId: String(ids.neighbour._id),
    });

  assert.equal(walkUp.status, 201);
  assert.equal(walkUp.body.data.status, "pending", "the flat has to answer first");

  ids.walkUp = walkUp.body.data._id;

});

test("a guard must say which flat a walk-up is for", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/visitors")
    .set(as("guard"))
    .send({ name: "Nobody", phone: "9123456782", purpose: "other" });

  assert.equal(res.status, 400);

});

test("only the flat being visited answers a walk-up", { skip }, async () => {

  const wrong = await request(app)
    .patch(`/api/security/visitors/${ids.walkUp}/approve`)
    .set(as("resident"))
    .send({});

  assert.equal(wrong.status, 403, "that visitor is for another flat");

  // Nor can the guard who raised it wave it through themselves.
  const guard = await request(app)
    .patch(`/api/security/visitors/${ids.walkUp}/approve`)
    .set(as("guard"))
    .send({});

  assert.equal(guard.status, 403);

  const right = await request(app)
    .patch(`/api/security/visitors/${ids.walkUp}/approve`)
    .set(as("neighbour"))
    .send({});

  assert.equal(right.status, 200);
  assert.equal(right.body.data.status, "approved");

});

test("answering twice is refused", { skip }, async () => {

  const res = await request(app)
    .patch(`/api/security/visitors/${ids.walkUp}/approve`)
    .set(as("neighbour"))
    .send({});

  assert.equal(res.status, 409);

});


// =======================================================
// SCANNING
// =======================================================

test("a typed pass code works as well as a scanned one", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: ids.passCode.toLowerCase() });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.direction, "entry");
  assert.ok(res.body.data.visitor.entryTime);

});

test("the same code releases them on the second scan", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: ids.passCode });

  assert.equal(res.body.data.direction, "exit");

  // And a third scan has nothing left to do.
  const third = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: ids.passCode });

  assert.equal(third.status, 409);

});

test("a pass from another society does not scan here", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guardB"))
    .send({ raw: ids.passCode });

  // The society comes from the guard's token, never from the code.
  assert.equal(res.status, 404);

});

test("an expired pass is refused", { skip }, async () => {

  const created = await request(app)
    .post("/api/security/visitors")
    .set(as("resident"))
    .send({ name: "Late Guest", phone: "9123456783", purpose: "guest", validHours: 1 });

  await mongoose.model("VisitorRequest").updateOne(
    { _id: created.body.data._id },
    { $set: { passExpiresAt: new Date(Date.now() - 1000) } }
  );

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: created.body.data.passCode });

  assert.equal(res.status, 410);

});

test("an unapproved walk-up cannot be scanned in", { skip }, async () => {

  const walkUp = await request(app)
    .post("/api/security/visitors")
    .set(as("guard"))
    .send({
      name: "Unknown", phone: "9123456784", purpose: "other",
      residentId: String(ids.resident._id),
    });

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: walkUp.body.data.passCode });

  assert.equal(res.status, 409);

});

test("a resident cannot scan, only the gate can", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("resident"))
    .send({ raw: ids.passCode });

  assert.equal(res.status, 403);

});

test("the QR carries no personal detail", { skip }, async () => {

  const pass = await request(app)
    .get(`/api/security/visitors/${ids.visitor}/pass`)
    .set(as("resident"));

  assert.equal(pass.status, 200);

  // The image is a data URI of the encoded payload. What matters is
  // that the payload itself names nobody — anyone can photograph a
  // screen.
  const visitor = await mongoose.model("VisitorRequest").findById(ids.visitor).lean();

  assert.ok(!String(visitor.qr).includes(visitor.visitorName));

});

test("a neighbour cannot fetch someone else's pass", { skip }, async () => {

  const res = await request(app)
    .get(`/api/security/visitors/${ids.visitor}/pass`)
    .set(as("neighbour"));

  assert.equal(res.status, 403);

});

test("a visitor already inside cannot be deleted", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/security/visitors/${ids.visitor}`)
    .set(as("resident"));

  assert.equal(res.status, 409, "that is a gate record now");

});


// =======================================================
// SCOPES
// =======================================================

test("scope=mine is this resident's visitors only", { skip }, async () => {

  const mine = await request(app)
    .get("/api/security/visitors?scope=mine")
    .set(as("resident"));

  assert.ok(mine.body.data.length >= 1);
  assert.ok(
    mine.body.data.every((v) => v.resident?.name === "Gate Res"),
    "a resident must not see the next flat's visitors"
  );

});

test("scope=society is refused to a plain resident", { skip }, async () => {

  const res = await request(app)
    .get("/api/security/visitors?scope=society")
    .set(as("resident"));

  assert.equal(res.status, 403);

  const guard = await request(app)
    .get("/api/security/visitors?scope=society")
    .set(as("guard"));

  assert.equal(guard.status, 200);

});


// =======================================================
// HOUSEHOLD STAFF
// =======================================================

test("household staff wait for the secretary and get no pass meanwhile", { skip }, async () => {

  const added = await request(app)
    .post("/api/security/staff/household")
    .set(as("resident"))
    .send({ name: "Sunita", phone: "9111111111", role: "maid", entryTime: "08:00" });

  assert.equal(added.status, 201);
  assert.equal(added.body.data.verificationStatus, "pending");
  assert.equal(added.body.data.passCode, null, "no pass before approval");

  ids.staff = added.body.data._id;

  const early = await request(app)
    .get(`/api/security/staff/${ids.staff}/pass`)
    .set(as("resident"));

  assert.equal(early.status, 409);

});

test("the queue is the secretary's, not a resident's", { skip }, async () => {

  const resident = await request(app)
    .get("/api/security/staff/household/pending")
    .set(as("resident"));

  assert.equal(resident.status, 403);

  const secretary = await request(app)
    .get("/api/security/staff/household/pending")
    .set(as("secretary"));

  assert.equal(secretary.status, 200);
  assert.equal(secretary.body.data.length, 1);
  assert.equal(secretary.body.data[0].resident.flatNumber, "A-101");

});

test("approving mints a pass that scans", { skip }, async () => {

  const decided = await request(app)
    .patch(`/api/security/staff/${ids.staff}/approval`)
    .set(as("secretary"))
    .send({ approved: true, validDays: 30 });

  assert.equal(decided.status, 200);
  assert.equal(decided.body.data.verificationStatus, "approved");
  assert.ok(decided.body.data.passCode);

  const staff = await mongoose.model("StaffProfile").findById(ids.staff).lean();

  const scan = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: JSON.stringify({ kind: "staff", passCode: staff.passCode }) });

  assert.equal(scan.status, 200);
  assert.equal(scan.body.data.kind, "staff");
  assert.equal(scan.body.data.direction, "entry");

  const out = await request(app)
    .post("/api/security/visitors/scan")
    .set(as("guard"))
    .send({ raw: JSON.stringify({ kind: "staff", passCode: staff.passCode }) });

  assert.equal(out.body.data.direction, "exit");

});

test("a resident sees society staff and their own, not a neighbour's", { skip }, async () => {

  const res = await request(app)
    .get("/api/security/staff")
    .set(as("neighbour"));

  assert.ok(
    !res.body.data.some((s) => String(s._id) === String(ids.staff)),
    "another flat's maid is not the neighbour's business"
  );

  const mine = await request(app).get("/api/security/staff").set(as("resident"));

  assert.ok(mine.body.data.some((s) => String(s._id) === String(ids.staff)));

});


// =======================================================
// SOCIETY STAFF AND GUARD LOGINS
// =======================================================

test("adding a guard with a login creates an account that works", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/staff")
    .set(as("secretary"))
    .send({
      name: "New Guard", phone: "9222222222", role: "security",
      createLogin: true, password: "guard-password",
      email: "newguard@test.com",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.verificationStatus, "approved");

  const login = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "newguard@test.com", password: "guard-password" });

  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.societyRole, "security");

  ids.newGuard = res.body.data._id;

});

test("a short password is refused before an account is made", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/staff")
    .set(as("secretary"))
    .send({
      name: "Weak", phone: "9333333333", role: "security",
      createLogin: true, password: "abc",
    });

  assert.equal(res.status, 400);

});

test("a resident cannot add society staff", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/staff")
    .set(as("resident"))
    .send({ name: "Sneaky", phone: "9444444444", role: "security" });

  assert.equal(res.status, 403);

});

test("removing a guard ends their login and keeps the history", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/security/staff/${ids.newGuard}`)
    .set(as("secretary"));

  assert.equal(res.status, 200);

  const staff = await mongoose.model("StaffProfile").findById(ids.newGuard).lean();

  assert.ok(staff, "the attendance history references this row");
  assert.equal(staff.isActive, false);
  assert.equal(staff.passCode, null);

  const account = await mongoose.model("User").findById(staff.userId).lean();

  assert.equal(account.status, "rejected");
  assert.equal(account.tokenVersion, 1, "any live session must die with it");

  const login = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "newguard@test.com", password: "guard-password" });

  assert.notEqual(login.status, 200, "a dismissed guard cannot sign back in");

});


// =======================================================
// ATTENDANCE
// =======================================================

test("marking present twice closes the day rather than duplicating", { skip }, async () => {

  const StaffAttendance = mongoose.model("StaffAttendance");

  await StaffAttendance.deleteMany({ staffId: ids.staff });

  const inn = await request(app)
    .post("/api/security/attendance")
    .set(as("guard"))
    .send({ staffId: String(ids.staff), status: "present" });

  assert.equal(inn.body.data.direction, "entry");

  const out = await request(app)
    .post("/api/security/attendance")
    .set(as("guard"))
    .send({ staffId: String(ids.staff), status: "present" });

  assert.equal(out.body.data.direction, "exit");

  const rows = await StaffAttendance.find({ staffId: ids.staff }).lean();

  assert.equal(rows.length, 1, "one record with two ends, not two records");

});

test("a resident cannot mark attendance", { skip }, async () => {

  const res = await request(app)
    .post("/api/security/attendance")
    .set(as("resident"))
    .send({ staffId: String(ids.staff), status: "present" });

  assert.equal(res.status, 403);

});

test("the monthly report counts distinct days worked", { skip }, async () => {

  const now = new Date();

  const res = await request(app)
    .get(`/api/security/attendance/report?month=${now.getMonth() + 1}&year=${now.getFullYear()}`)
    .set(as("secretary"));

  assert.equal(res.status, 200);

  const row = res.body.data.staff.find((s) => String(s.staffId) === String(ids.staff));

  assert.ok(row);
  // Scanning in and out twice in one day is one day worked.
  assert.equal(row.daysWorked, 1);

});

test("a bad month or year is refused", { skip }, async () => {

  for (const q of ["month=13&year=2026", "month=1&year=1800", "month=abc&year=2026"]) {
    const res = await request(app)
      .get(`/api/security/attendance/report?${q}`)
      .set(as("secretary"));

    assert.equal(res.status, 400, `${q} should be refused`);
  }

});

test("on-duty is whoever scanned in and has not left", { skip }, async () => {

  const StaffAttendance = mongoose.model("StaffAttendance");

  await StaffAttendance.deleteMany({ staffId: ids.staff });

  const before = await request(app).get("/api/security/on-duty").set(as("guard"));

  assert.equal(before.body.data.length, 0);

  await request(app)
    .post("/api/security/attendance")
    .set(as("guard"))
    .send({ staffId: String(ids.staff), status: "present" });

  const after = await request(app).get("/api/security/on-duty").set(as("guard"));

  assert.equal(after.body.data.length, 1);
  assert.equal(after.body.data[0].name, "Sunita");

});


// =======================================================
// A CLOSED ACCOUNT IS CLOSED
//
// The status check used to apply only to plain members, so any role
// above member — guard, secretary, treasurer — kept a working login
// after being rejected. Pinned here because it is invisible until
// someone tries it.
// =======================================================

test("a rejected account of any role cannot sign in", { skip }, async () => {

  const User = mongoose.model("User");
  const bcrypt = require("bcrypt");

  const password = await bcrypt.hash("some-password", 10);

  const cases = ["security", "secretary", "treasurer", "committee_member", "member"];

  for (const societyRole of cases) {

    const email = `closed-${societyRole}@test.com`;

    await User.create({
      name: `Closed ${societyRole}`,
      email,
      phone: `95111${String(cases.indexOf(societyRole)).padStart(5, "0")}`,
      password,
      societyId: ids.societyA,
      societyRole,
      systemRole: "user",
      status: "rejected",
      isVerified: true,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: email, password: "some-password" });

    assert.equal(res.status, 403, `a rejected ${societyRole} must not sign in`);

  }

});

test("an approved committee account still signs in", { skip }, async () => {

  // The fix must not lock out the roles that legitimately skip the
  // secretary-approval queue.
  const bcrypt = require("bcrypt");

  await mongoose.model("User").updateOne(
    { _id: ids.secretary._id },
    { $set: { password: await bcrypt.hash("secretary-password", 10) } }
  );

  const res = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "gate-sec@test.com", password: "secretary-password" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.user.societyRole, "secretary");

});

test("a salesperson sitting at pending still signs in", { skip }, async () => {

  // Salespeople are created without a status, so they default to
  // pending. Requiring "approved" for everyone would have locked the
  // whole platform team out — which is why only rejected blocks.
  const bcrypt = require("bcrypt");

  await mongoose.model("User").create({
    name: "Sales One",
    email: "gate-sales@test.com",
    phone: "9599999999",
    password: await bcrypt.hash("sales-password", 10),
    systemRole: "salesperson",
    status: "pending",
  });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "gate-sales@test.com", password: "sales-password" });

  assert.equal(res.status, 200);

});
