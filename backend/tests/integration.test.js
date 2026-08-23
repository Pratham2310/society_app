const test = require("node:test");
const assert = require("node:assert");

//Load .env so MONGO_URI is available. Only the database NAME is used
//from it — helpers/db.js always swaps in a throwaway database.
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

// These exercise real writes. Without a database there is nothing
// meaningful to assert, so skip rather than fail.
const skip = !db.isAvailable() && "no MONGO_URI / TEST_MONGO_URI configured";

if (!skip) {
  require("../models/plugins/register");
}

const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = skip ? null : require("../app");
const { JWT_ISSUER, JWT_AUDIENCE } = skip
  ? {}
  : require("../middleware/authMiddleware");

// ---- fixtures ------------------------------------------------------

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
  const GuestPass = mongoose.model("GuestPass");

  const societyA = new mongoose.Types.ObjectId();
  const societyB = new mongoose.Types.ObjectId();

  await Society.create([
    { _id: societyA, name: "Society A", societyCode: "100001" },
    { _id: societyB, name: "Society B", societyCode: "100002" },
  ]);

  const [residentA, guardA, secretaryA, residentB, secretaryB] = await User.create([
    { name: "Res A", email: "resa@test.com", phone: "9000000001", societyId: societyA,
      societyRole: "member", systemRole: "user", status: "approved", isVerified: true },
    { name: "Guard A", email: "guarda@test.com", phone: "9000000002", societyId: societyA,
      societyRole: "security", systemRole: "user", status: "approved", isVerified: true },
    { name: "Sec A", email: "seca@test.com", phone: "9000000003", societyId: societyA,
      societyRole: "secretary", systemRole: "user", status: "approved", isVerified: true },
    { name: "Res B", email: "resb@test.com", phone: "9000000004", societyId: societyB,
      societyRole: "member", systemRole: "user", status: "approved", isVerified: true },
    { name: "Sec B", email: "secb@test.com", phone: "9000000005", societyId: societyB,
      societyRole: "secretary", systemRole: "user", status: "approved", isVerified: true },
  ]);

  const wing = await Wing.create({
    societyId: societyA, name: "A", totalFloors: 5, flatsPerFloor: 4,
  });

  const flat = await Flat.create({
    societyId: societyA, wingId: wing._id, flatNumber: "A-101", floor: 1,
  });

  const pass = await GuestPass.create({
    societyId: societyA, residentId: residentA._id,
    flatId: flat._id, wingId: wing._id,
    guestName: "Visitor One", guestPhone: "9123456780",
    arrivalDate: new Date(), qrToken: `tok-${Date.now()}`,
    createdBy: residentA._id, status: "active",
  });

  Object.assign(ids, {
    societyA, societyB,
    residentA, guardA, secretaryA, residentB, secretaryB,
    wing, flat, pass,
    tokens: {
      residentA: tokenFor(residentA),
      guardA: tokenFor(guardA),
      secretaryA: tokenFor(secretaryA),
      residentB: tokenFor(residentB),
      secretaryB: tokenFor(secretaryB),
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


// =======================================================
// AUTH
// =======================================================

test("an unauthenticated request is rejected", { skip }, async () => {

  const res = await request(app).get("/api/v1/notices");

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);

});


test("a token signed with the wrong secret is rejected", { skip }, async () => {

  const forged = jwt.sign(
    { id: ids.residentA._id, societyId: ids.societyA },
    "not-the-real-secret-but-long-enough-32",
    { expiresIn: "1h", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );

  const res = await request(app)
    .get("/api/v1/notices")
    .set("Authorization", `Bearer ${forged}`);

  assert.strictEqual(res.status, 401);

});


test("a token without the right audience is rejected", { skip }, async () => {

  const wrongAudience = jwt.sign(
    { id: ids.residentA._id, societyId: ids.societyA },
    process.env.JWT_SECRET,
    { expiresIn: "1h", issuer: JWT_ISSUER, audience: "some-other-app" }
  );

  const res = await request(app)
    .get("/api/v1/notices")
    .set("Authorization", `Bearer ${wrongAudience}`);

  assert.strictEqual(res.status, 401);

});


// =======================================================
// TENANT ISOLATION — against real documents
// =======================================================

test("a notice created in one society is invisible to another", { skip }, async () => {

  const created = await request(app)
    .post("/api/v1/notices")
    .set("Authorization", `Bearer ${ids.tokens.secretaryA}`)
    .send({ title: "Society A only", description: "secret", type: "notice" });

  assert.strictEqual(created.status, 201, JSON.stringify(created.body));

  const noticeId = created.body.data._id;

  const own = await request(app)
    .get(`/api/v1/notices/${noticeId}`)
    .set("Authorization", `Bearer ${ids.tokens.residentA}`);

  assert.strictEqual(own.status, 200, "the owning society must see it");

  const other = await request(app)
    .get(`/api/v1/notices/${noticeId}`)
    .set("Authorization", `Bearer ${ids.tokens.residentB}`);

  assert.strictEqual(other.status, 404, "another society must not see it");

});


test("a cross-society delete changes nothing", { skip }, async () => {

  const created = await request(app)
    .post("/api/v1/notices")
    .set("Authorization", `Bearer ${ids.tokens.secretaryA}`)
    .send({ title: "Do not delete", description: "x", type: "notice" });

  const noticeId = created.body.data._id;

  // Society B's SECRETARY, not a random member: this caller holds the
  // role the route demands, so only tenant scoping stands between them
  // and another society's record. A member would be stopped one step
  // earlier by the role check and prove nothing about isolation.
  const attack = await request(app)
    .delete(`/api/v1/notices/${noticeId}`)
    .set("Authorization", `Bearer ${ids.tokens.secretaryB}`);

  assert.strictEqual(attack.status, 404, "must not reveal that the record exists");

  const survived = await request(app)
    .get(`/api/v1/notices/${noticeId}`)
    .set("Authorization", `Bearer ${ids.tokens.residentA}`);

  assert.strictEqual(survived.status, 200, "the record must still exist");
  assert.strictEqual(survived.body.data.title, "Do not delete");

});


// =======================================================
// AUTHORISATION
// =======================================================

test("a resident cannot use a guard-only endpoint", { skip }, async () => {

  const res = await request(app)
    .post("/api/v1/gate-log/scan-entry")
    .set("Authorization", `Bearer ${ids.tokens.residentA}`)
    .send({ guestPassId: String(ids.pass._id) });

  assert.strictEqual(res.status, 403);

});


// =======================================================
// GATE SCAN — the flow that only breaks against a real database
// =======================================================

test("a guard can scan a visitor in", { skip }, async () => {

  const res = await request(app)
    .post("/api/v1/gate-log/scan-entry")
    .set("Authorization", `Bearer ${ids.tokens.guardA}`)
    .send({ guestPassId: String(ids.pass._id) });

  assert.strictEqual(res.status, 201, JSON.stringify(res.body));

  // wingId was missing from the log builder and only a real write
  // surfaced it, because GateLog requires it.
  assert.ok(res.body.data.wingId, "the gate log must carry wingId");
  assert.ok(res.body.data.societyId, "the gate log must carry societyId");
  assert.ok(res.body.data.flatId, "the gate log must carry flatId");

});


test("a retried scan with the same idempotency key does not duplicate", { skip }, async () => {

  const GateLog = mongoose.model("GateLog");
  const GuestPass = mongoose.model("GuestPass");

  const pass = await GuestPass.create({
    societyId: ids.societyA, residentId: ids.residentA._id,
    flatId: ids.flat._id, wingId: ids.wing._id,
    guestName: "Visitor Two", guestPhone: "9123456781",
    arrivalDate: new Date(), qrToken: `tok-idem-${Date.now()}`,
    createdBy: ids.residentA._id, status: "active",
  });

  const key = `idem-${Date.now()}-abcdef`;

  const send = () =>
    request(app)
      .post("/api/v1/gate-log/scan-entry")
      .set("Authorization", `Bearer ${ids.tokens.guardA}`)
      .set("Idempotency-Key", key)
      .send({ guestPassId: String(pass._id) });

  const first = await send();
  assert.strictEqual(first.status, 201, JSON.stringify(first.body));

  const retry = await send();
  assert.strictEqual(retry.status, 201);
  assert.strictEqual(retry.headers["idempotent-replay"], "true");

  const logs = await GateLog.countDocuments({ guestPassId: pass._id });

  assert.strictEqual(logs, 1, "a retry must not create a second gate log");

});


// =======================================================
// PAGINATION — against real rows
// =======================================================

test("offset and cursor paging walk the same rows without gaps", { skip }, async () => {

  const Notice = mongoose.model("Notice");

  await Notice.deleteMany({ societyId: ids.societyA });

  const docs = Array.from({ length: 25 }, (_, i) => ({
    societyId: ids.societyA,
    title: `Notice ${String(i + 1).padStart(2, "0")}`,
    description: "d",
    type: "notice",
    createdBy: ids.residentA._id,
  }));

  await Notice.insertMany(docs);

  const auth = { Authorization: `Bearer ${ids.tokens.residentA}` };

  const page1 = await request(app)
    .get("/api/v1/notices?page=1&limit=10")
    .set(auth);

  assert.strictEqual(page1.body.data.length, 10);
  assert.strictEqual(page1.body.meta.total, 25);
  assert.strictEqual(page1.body.meta.totalPages, 3);

  const page3 = await request(app)
    .get("/api/v1/notices?page=3&limit=10")
    .set(auth);

  assert.strictEqual(page3.body.data.length, 5);
  assert.strictEqual(page3.body.meta.hasMore, false);

  // Cursor mode must be startable without already holding a cursor.
  const cursor1 = await request(app)
    .get("/api/v1/notices?mode=cursor&limit=10")
    .set(auth);

  assert.strictEqual(cursor1.body.data.length, 10);
  assert.ok(cursor1.body.meta.nextCursor, "must hand back a cursor");

  const cursor2 = await request(app)
    .get(`/api/v1/notices?limit=10&cursor=${cursor1.body.meta.nextCursor}`)
    .set(auth);

  assert.strictEqual(cursor2.body.data.length, 10);

  const seen = new Set([
    ...cursor1.body.data.map((n) => n._id),
    ...cursor2.body.data.map((n) => n._id),
  ]);

  assert.strictEqual(seen.size, 20, "cursor pages must not repeat rows");

});


test("limit is clamped no matter what the client asks for", { skip }, async () => {

  const res = await request(app)
    .get("/api/v1/notices?limit=9999")
    .set("Authorization", `Bearer ${ids.tokens.residentA}`);

  assert.strictEqual(res.body.meta.limit, 100);

});


// =======================================================
// NOTIFICATIONS
// =======================================================

test("a device registers and the token lands on the user", { skip }, async () => {

  const User = mongoose.model("User");

  const res = await request(app)
    .post("/api/v1/notifications/devices")
    .set("Authorization", `Bearer ${ids.tokens.residentA}`)
    .send({ token: "ExponentPushToken[integrationTest1]", platform: "android" });

  assert.strictEqual(res.status, 201, JSON.stringify(res.body));

  const user = await User.findById(ids.residentA._id).lean();

  assert.strictEqual(user.pushTokens.length, 1);
  assert.strictEqual(user.pushTokens[0].token, "ExponentPushToken[integrationTest1]");

});


test("a bogus push token is rejected", { skip }, async () => {

  const res = await request(app)
    .post("/api/v1/notifications/devices")
    .set("Authorization", `Bearer ${ids.tokens.residentA}`)
    .send({ token: "definitely-not-expo" });

  assert.strictEqual(res.status, 400);

});


test("re-registering a token moves it off the previous holder", { skip }, async () => {

  const User = mongoose.model("User");

  const token = "ExponentPushToken[sharedHandset]";

  await request(app)
    .post("/api/v1/notifications/devices")
    .set("Authorization", `Bearer ${ids.tokens.guardA}`)
    .send({ token, platform: "android" });

  // Same physical handset, next shift, different guard.
  await request(app)
    .post("/api/v1/notifications/devices")
    .set("Authorization", `Bearer ${ids.tokens.residentA}`)
    .send({ token, platform: "android" });

  const guard = await User.findById(ids.guardA._id).lean();

  assert.ok(
    !(guard.pushTokens || []).some((t) => t.token === token),
    "the previous holder must not keep receiving the new holder's alerts"
  );

});


// =======================================================
// AUDIT
// =======================================================

test("a role change is recorded in the audit log", { skip }, async () => {

  const AuditLog = mongoose.model("AuditLog");

  const res = await request(app)
    .put(`/api/v1/users/update-role/${ids.residentA._id}`)
    .set("Authorization", `Bearer ${ids.tokens.secretaryA}`)
    .send({ role: "treasurer" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const entry = await AuditLog.findOne({
    action: "user.role_changed",
    targetId: ids.residentA._id,
  }).lean();

  assert.ok(entry, "a role change must be auditable");
  assert.strictEqual(String(entry.actorId), String(ids.secretaryA._id));
  assert.strictEqual(entry.metadata.newRole, "treasurer");

});


// =======================================================
// OBSERVABILITY
// =======================================================

test("every response carries a request id", { skip }, async () => {

  const res = await request(app).get("/api/v1/notices");

  assert.ok(res.headers["x-request-id"], "responses must be traceable");

});


test("a client-supplied request id is preserved", { skip }, async () => {

  const res = await request(app)
    .get("/api/v1/notices")
    .set("X-Request-Id", "expo-crash-42");

  assert.strictEqual(res.headers["x-request-id"], "expo-crash-42");

});


// =======================================================
// SCHEDULED JOBS
// =======================================================

test("the expiry job closes out passes that are past their date", { skip }, async () => {

  const GuestPass = mongoose.model("GuestPass");

  const stale = await GuestPass.create({
    societyId: ids.societyA, residentId: ids.residentA._id,
    flatId: ids.flat._id, wingId: ids.wing._id,
    guestName: "Old Visitor", guestPhone: "9123456782",
    arrivalDate: new Date(Date.now() - 172800000),
    expiryDate: new Date(Date.now() - 86400000),
    qrToken: `tok-stale-${Date.now()}`,
    createdBy: ids.residentA._id, status: "active",
  });

  const { JOBS } = require("../scripts/jobs/runJobs");

  const result = await JOBS.expirePasses();

  assert.ok(result.affected >= 1);

  const after = await GuestPass.findById(stale._id).lean();

  assert.strictEqual(after.status, "expired");

  // Idempotent: a second run must find nothing left to do.
  const again = await JOBS.expirePasses();

  assert.strictEqual(again.affected, 0, "the job must be safe to re-run");

});


// =======================================================
// REGISTRATION READ PATH
// The screens before a resident has an account.
// =======================================================

test("a society code resolves to a society, spacing forgiven", { skip }, async () => {

  // Six boxes on screen, but a paste can carry whitespace.
  const res = await request(app)
    .post("/api/v1/societies/verify-code")
    .send({ societyCode: " 100001 " });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.data.name, "Society A");
  assert.ok("city" in res.body.data, "the join screen shows the city back");

});


test("an unknown code is a clear 404, not a crash", { skip }, async () => {

  const res = await request(app)
    .post("/api/v1/societies/verify-code")
    .send({ societyCode: "999999" });

  assert.strictEqual(res.status, 404);
  assert.match(res.body.message, /secretary/i, "tell them who to ask");

});


test("wings, floors and flats are readable without a token", { skip }, async () => {

  // The resident is mid-registration. register-full is what creates
  // the account, so this step cannot require one.
  const res = await request(app)
    .get(`/api/v1/societies/${ids.societyA}/structure`);

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const { society, wings } = res.body.data;

  assert.strictEqual(society.name, "Society A");
  assert.ok(wings.length >= 1, "the society has wings");

  const wing = wings[0];

  assert.ok(wing.floors.length >= 1, "the wing has floors");
  assert.ok(
    typeof wing.floors[0].availableCount === "number",
    "a floor reports how many flats are free"
  );

  const flat = wing.floors[0].flats[0];

  assert.ok(flat.flatNumber, "flats are identified by number");
  assert.strictEqual(
    typeof flat.isOccupied,
    "boolean",
    "occupied flats must be marked so the picker can disable them"
  );

});


test("the structure exposes no resident data", { skip }, async () => {

  const res = await request(app)
    .get(`/api/v1/societies/${ids.societyA}/structure`);

  const body = JSON.stringify(res.body);

  // A building layout is public knowledge. Who lives in it is not.
  for (const leak of ["resa@test.com", "9000000001", "Res A", "password"]) {
    assert.ok(
      !body.includes(leak),
      `the public structure must not leak "${leak}"`
    );
  }

});


test("a malformed society id is a 400, not a 500", { skip }, async () => {

  const res = await request(app)
    .get("/api/v1/societies/not-an-id/structure");

  assert.strictEqual(res.status, 400);

});


test("one resident claiming a flat blocks the next", { skip }, async () => {

  const Flat = mongoose.model("Flat");

  const flat = await Flat.findOne({ societyId: ids.societyA }).lean();

  // Simulate the claim registerFull performs.
  const first = await Flat.findOneAndUpdate(
    { _id: flat._id, isOccupied: false },
    { $set: { isOccupied: true } },
    { new: true }
  );

  const second = await Flat.findOneAndUpdate(
    { _id: flat._id, isOccupied: false },
    { $set: { isOccupied: true } },
    { new: true }
  );

  assert.ok(first, "the first claim succeeds");
  assert.strictEqual(
    second,
    null,
    "the second must find nothing to claim — this is what stops two residents taking one flat"
  );

  await Flat.updateOne({ _id: flat._id }, { $set: { isOccupied: false } });

});


test("a society code with letters is rejected outright", { skip }, async () => {

  // Codes are digits only: they get read aloud and typed into six
  // boxes, so letters would only add spelling and O/0 confusion.
  for (const bad of ["ABC123", "12345", "1234567", "12A456"]) {

    const res = await request(app)
      .post("/api/v1/societies/verify-code")
      .send({ societyCode: bad });

    assert.strictEqual(
      res.status,
      400,
      `"${bad}" must be rejected as malformed, not looked up`
    );

  }

});


// =======================================================
// SUPERADMIN ONBOARDING
// The chain that turns a sales call into a society residents can join.
// =======================================================

const onboardSociety = async (token, label) => {

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const step1 = await request(app)
    .post("/api/v1/onboarding/step1")
    .set("Authorization", `Bearer ${token}`)
    .send({
      societyName: `${label} ${stamp}`,
      address: "1 Test Road", city: "Nashik", state: "MH", pincode: "422001",
    });

  assert.strictEqual(step1.status, 200, JSON.stringify(step1.body));

  const draftId = step1.body.data._id;

  await request(app)
    .post("/api/v1/onboarding/step2")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId, structure: [{ name: "A", totalFloors: 2, flatsPerFloor: 3 }] });

  await request(app)
    .post("/api/v1/onboarding/step3")
    .set("Authorization", `Bearer ${token}`)
    .send({
      draftId,
      secretary: {
        name: "Onboard Sec",
        email: `onboardsec${stamp}@test.com`,
        phone: String(9600000000 + (Number(stamp) % 99999999)).slice(0, 10),
        password: "Password123!",
      },
    });

  await request(app)
    .post("/api/v1/onboarding/step4")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId, services: [] });

  return request(app)
    .post("/api/v1/onboarding/finalize")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId });

};


test("a superadmin can do anything a salesperson can", { skip }, async () => {

  const User = mongoose.model("User");

  const superadmin = await User.create({
    name: "Super", email: `super${Date.now()}@test.com`, phone: "9500000001",
    systemRole: "superadmin", status: "approved", isVerified: true,
  });

  // Onboarding and every /sales route is gated on "salesperson". A
  // superadmin owning the platform but getting 403 on the console's two
  // core jobs was the state before this.
  const res = await request(app)
    .get("/api/v1/sales/dashboard")
    .set("Authorization", `Bearer ${tokenFor(superadmin)}`);

  assert.strictEqual(res.status, 200, "superadmin must reach salesperson routes");

});


test("a superadmin can create a salesperson", { skip }, async () => {

  const User = mongoose.model("User");

  const superadmin = await User.create({
    name: "Super2", email: `super2${Date.now()}@test.com`, phone: "9500000002",
    systemRole: "superadmin", status: "approved", isVerified: true,
  });

  const stamp = Date.now();

  // userRepository dropped findByEmail and createUser by reassigning
  // module.exports, so this failed with "is not a function".
  const res = await request(app)
    .post("/api/v1/admin/create-salesperson")
    .set("Authorization", `Bearer ${tokenFor(superadmin)}`)
    .send({
      name: "New Sales",
      email: `newsales${stamp}@test.com`,
      password: "Password123!",
      phone: String(9400000000 + (stamp % 99999999)).slice(0, 10),
    });

  assert.strictEqual(res.status, 201, JSON.stringify(res.body));

  const created = await User.findOne({ email: `newsales${stamp}@test.com` }).lean();

  assert.strictEqual(created.systemRole, "salesperson");

});


test("onboarding produces a joinable society", { skip }, async () => {

  const User = mongoose.model("User");

  const superadmin = await User.create({
    name: "Super3", email: `super3${Date.now()}@test.com`, phone: "9500000003",
    systemRole: "superadmin", status: "approved", isVerified: true,
  });

  const res = await onboardSociety(tokenFor(superadmin), "Onboarded");

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const { society, secretary } = res.body.data;

  // finalize passed wingData.wingName while step2 stores "name", so
  // createWing always got undefined and no society could be onboarded.
  assert.ok(society.societyCode, "the society must get a code");
  assert.match(society.societyCode, /^[0-9]{6}$/, "codes are six digits");
  assert.ok(secretary, "onboarding creates the secretary account");
  assert.strictEqual(secretary.societyRole, "secretary");

  // The whole point: a resident can now join with that code.
  const verify = await request(app)
    .post("/api/v1/societies/verify-code")
    .send({ societyCode: society.societyCode });

  assert.strictEqual(verify.status, 200, "the issued code must resolve");

  const structure = await request(app)
    .get(`/api/v1/societies/${society._id}/structure`);

  assert.strictEqual(structure.status, 200);

  const wings = structure.body.data.wings;

  assert.strictEqual(wings.length, 1, "the wing from step2 exists");
  assert.strictEqual(wings[0].name, "A");
  assert.strictEqual(
    wings[0].floors.reduce((n, f) => n + f.flats.length, 0),
    6,
    "2 floors x 3 flats were generated"
  );

});


// =======================================================
// PLATFORM SCOPE
// A salesperson sees what they onboarded. A superadmin owns the
// platform and must see everything, or the console shows them an
// empty dashboard on a populated system.
// =======================================================

test("a salesperson sees only the societies they onboarded", { skip }, async () => {

  const User = mongoose.model("User");

  const [alice, bob] = await User.create([
    { name: "Alice Sales", email: `alice${Date.now()}@test.com`, phone: "9550000001",
      systemRole: "salesperson", status: "approved", isVerified: true },
    { name: "Bob Sales", email: `bob${Date.now()}@test.com`, phone: "9550000002",
      systemRole: "salesperson", status: "approved", isVerified: true },
  ]);

  await onboardSociety(tokenFor(alice), "Alice Society");

  const hers = await request(app)
    .get("/api/v1/sales/societies?page=1&limit=20")
    .set("Authorization", `Bearer ${tokenFor(alice)}`);

  const his = await request(app)
    .get("/api/v1/sales/societies?page=1&limit=20")
    .set("Authorization", `Bearer ${tokenFor(bob)}`);

  assert.ok(
    hers.body.data.societies.length >= 1,
    "the salesperson who onboarded it must see it"
  );

  assert.strictEqual(
    his.body.data.societies.length,
    0,
    "another salesperson must not see it"
  );

});


test("a superadmin sees every society on the platform", { skip }, async () => {

  const User = mongoose.model("User");

  const seller = await User.create({
    name: "Seller", email: `seller${Date.now()}@test.com`, phone: "9550000003",
    systemRole: "salesperson", status: "approved", isVerified: true,
  });

  const boss = await User.create({
    name: "Boss", email: `boss${Date.now()}@test.com`, phone: "9550000004",
    systemRole: "superadmin", status: "approved", isVerified: true,
  });

  await onboardSociety(tokenFor(seller), "Someone Elses Society");

  // The superadmin onboarded none of these. Filtering on createdBy
  // showed them zero societies on a platform that had several.
  const res = await request(app)
    .get("/api/v1/sales/societies?page=1&limit=50")
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(res.status, 200);

  assert.ok(
    res.body.data.societies.length >= 1,
    "a superadmin must see societies they did not personally onboard"
  );

  const dash = await request(app)
    .get("/api/v1/sales/dashboard")
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.ok(
    dash.body.data.totalSocieties >= 1,
    "the dashboard count must match what the list shows"
  );

});
