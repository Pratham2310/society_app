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
// ADMIN MANAGEMENT
//
// The destructive half of the console. Every guard asserted here
// exists because the alternative is unrecoverable through the UI.
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

const makeUser = (systemRole, label) => {
  const stamp = unique();
  return mongoose.model("User").create({
    name: label,
    email: `${label.replace(/[^a-z]/gi, "").toLowerCase()}${stamp}@test.com`,
    phone: String(9590000000 + (Number(stamp.slice(-7)) % 9999999)).slice(0, 10),
    systemRole,
    status: "approved",
    isVerified: true,
  });
};

const onboard = async (token, label) => {

  const stamp = unique();

  const step1 = await request(app)
    .post("/api/v1/onboarding/step1")
    .set("Authorization", `Bearer ${token}`)
    .send({
      societyName: `${label} ${stamp}`,
      address: "1 Test Road", city: "Nashik", state: "MH", pincode: "422001",
    });

  const draftId = step1.body.data._id;

  await request(app).post("/api/v1/onboarding/step2")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId, structure: [{ name: "A", totalFloors: 2, flatsPerFloor: 2 }] });

  await request(app).post("/api/v1/onboarding/step3")
    .set("Authorization", `Bearer ${token}`)
    .send({
      draftId,
      secretary: {
        name: "Onboard Sec",
        email: `obsec${stamp}@test.com`,
        phone: String(9591000000 + (Number(stamp.slice(-6)) % 999999)).slice(0, 10),
        password: "Password123!",
      },
    });

  await request(app).post("/api/v1/onboarding/step4")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId, services: [] });

  const done = await request(app).post("/api/v1/onboarding/finalize")
    .set("Authorization", `Bearer ${token}`)
    .send({ draftId });

  assert.strictEqual(done.status, 200, JSON.stringify(done.body));

  return done.body.data;

};

test.before(async () => {
  if (skip) return;
  await db.connect();
  await db.clear();
});

test.after(async () => {
  if (skip) return;
  await db.disconnect();
});


// =======================================================
// SALESPEOPLE
// =======================================================

test("a salesperson can be renamed and suspended", { skip }, async () => {

  const boss = await makeUser("superadmin", "Editor Boss");
  const stamp = unique();

  const created = await request(app)
    .post("/api/v1/admin/create-salesperson")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      name: "Before Rename", email: `rename${stamp}@test.com`,
      password: "Password123!", phone: "9581000001",
    });

  assert.strictEqual(created.status, 201, JSON.stringify(created.body));

  const id = created.body.data._id;

  const patched = await request(app)
    .patch(`/api/v1/admin/salespeople/${id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ name: "After Rename", status: "rejected" });

  assert.strictEqual(patched.status, 200, JSON.stringify(patched.body));

  const after = await mongoose.model("User").findById(id).lean();

  assert.strictEqual(after.name, "After Rename");
  assert.strictEqual(after.status, "rejected", "suspending disables the account");

});


test("editing a salesperson cannot escalate their role", { skip }, async () => {

  const boss = await makeUser("superadmin", "Escalation Boss");
  const stamp = unique();

  const created = await request(app)
    .post("/api/v1/admin/create-salesperson")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      name: "Climber", email: `climb${stamp}@test.com`,
      password: "Password123!", phone: "9581000002",
    });

  const id = created.body.data._id;

  await request(app)
    .patch(`/api/v1/admin/salespeople/${id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ systemRole: "superadmin", societyRole: "chairman" });

  const after = await mongoose.model("User").findById(id).lean();

  // Only whitelisted fields apply. Accepting systemRole would be the
  // same escalation hole the public bootstrap route was.
  assert.strictEqual(after.systemRole, "salesperson", "role is not editable here");

});


test("deleting a salesperson who owns societies is refused", { skip }, async () => {

  const boss = await makeUser("superadmin", "Delete Boss");
  const seller = await makeUser("salesperson", "Owns Things");

  await onboard(tokenFor(seller), "Owned Society");

  const res = await request(app)
    .delete(`/api/v1/admin/salespeople/${seller._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(res.status, 409, "must refuse rather than orphan the societies");
  assert.match(res.body.message, /suspend/i, "and say what to do instead");

  assert.ok(
    await mongoose.model("User").findById(seller._id),
    "the account survives the refusal"
  );

});


test("a salesperson with no societies can be deleted", { skip }, async () => {

  const boss = await makeUser("superadmin", "Clean Boss");
  const stamp = unique();

  const created = await request(app)
    .post("/api/v1/admin/create-salesperson")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      name: "Never Used", email: `unused${stamp}@test.com`,
      password: "Password123!", phone: "9581000003",
    });

  const id = created.body.data._id;

  const res = await request(app)
    .delete(`/api/v1/admin/salespeople/${id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(await mongoose.model("User").findById(id), null);

});


// =======================================================
// SOCIETIES
// =======================================================

test("society details can be corrected, but not the join code", { skip }, async () => {

  const boss = await makeUser("superadmin", "Details Boss");
  const { society } = await onboard(tokenFor(boss), "Editable Society");

  const res = await request(app)
    .patch(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ city: "Corrected City", societyCode: "000000" });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const after = await mongoose.model("Society").findById(society._id).lean();

  assert.strictEqual(after.city, "Corrected City");

  // Residents have the code written down; changing it would break
  // every registration already in progress.
  assert.strictEqual(
    after.societyCode,
    society.societyCode,
    "the join code must be immutable"
  );

});


test("deleting a society needs its name typed back", { skip }, async () => {

  const boss = await makeUser("superadmin", "Danger Boss");
  const { society } = await onboard(tokenFor(boss), "Deletable Society");

  const bare = await request(app)
    .delete(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({});

  assert.strictEqual(bare.status, 400, "a bare delete must not go through");

  const wrong = await request(app)
    .delete(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ confirmName: "Something Else" });

  assert.strictEqual(wrong.status, 400);

  assert.ok(
    await mongoose.model("Society").findById(society._id),
    "it must still exist after both refusals"
  );

});


test("deleting a society with residents in it is refused", { skip }, async () => {

  const boss = await makeUser("superadmin", "Occupied Boss");
  const { society } = await onboard(tokenFor(boss), "Occupied Society");

  await mongoose.model("User").create({
    name: "Lives Here", email: `lives${unique()}@test.com`, phone: "9581000004",
    societyId: society._id, societyRole: "member", systemRole: "user",
    status: "approved", isVerified: true,
  });

  const res = await request(app)
    .delete(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ confirmName: society.name });

  assert.strictEqual(res.status, 409, "people live there");

});


test("an empty society deletes cleanly, taking its wings and flats", { skip }, async () => {

  const boss = await makeUser("superadmin", "Empty Boss");
  const { society } = await onboard(tokenFor(boss), "Empty Society");

  const res = await request(app)
    .delete(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ confirmName: society.name });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  assert.strictEqual(await mongoose.model("Society").findById(society._id), null);

  // Orphaned wings and flats would still answer the public structure
  // endpoint for a society that no longer exists.
  assert.strictEqual(
    await mongoose.model("Wing").countDocuments({ societyId: society._id }),
    0,
    "wings go with it"
  );
  assert.strictEqual(
    await mongoose.model("Flat").countDocuments({ societyId: society._id }),
    0,
    "flats go with it"
  );

});


test("a salesperson cannot delete a society, even their own", { skip }, async () => {

  const seller = await makeUser("salesperson", "Not Allowed");
  const { society } = await onboard(tokenFor(seller), "Their Own Society");

  const res = await request(app)
    .delete(`/api/v1/societies/${society._id}`)
    .set("Authorization", `Bearer ${tokenFor(seller)}`)
    .send({ confirmName: society.name });

  assert.strictEqual(res.status, 403, "deletion is superadmin only");

});


// =======================================================
// SECRETARY HANDOVER
// =======================================================

test("assigning a secretary steps the previous one down", { skip }, async () => {

  const boss = await makeUser("superadmin", "Secretary Boss");
  const { society, secretary: original } = await onboard(tokenFor(boss), "Handover Society");

  const resident = await mongoose.model("User").create({
    name: "Promote Me", email: `promote${unique()}@test.com`, phone: "9581000005",
    societyId: society._id, societyRole: "member", systemRole: "user",
    status: "approved", isVerified: true,
  });

  const res = await request(app)
    .post(`/api/v1/societies/${society._id}/secretary`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ userId: String(resident._id) });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.data.secretary.name, "Promote Me");
  assert.ok(res.body.data.steppedDown, "the outgoing secretary is named in the response");

  // Two secretaries would both pass every permission check.
  const count = await mongoose.model("User").countDocuments({
    societyId: society._id, societyRole: "secretary",
  });

  assert.strictEqual(count, 1, "a society has exactly one secretary");

  const before = await mongoose.model("User").findById(original._id).lean();

  assert.strictEqual(before.societyRole, "member", "the previous one becomes a member");

});


test("a secretary can be created outright when nobody lives there yet", { skip }, async () => {

  const boss = await makeUser("superadmin", "Fresh Boss");
  const { society } = await onboard(tokenFor(boss), "Fresh Society");

  const stamp = unique();

  const res = await request(app)
    .post(`/api/v1/societies/${society._id}/secretary`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      name: "Brand New", email: `brandnew${stamp}@test.com`,
      phone: "9581000006", password: "Password123!",
    });

  assert.strictEqual(res.status, 200, JSON.stringify(res.body));

  const created = await mongoose.model("User")
    .findOne({ email: `brandnew${stamp}@test.com` }).lean();

  assert.strictEqual(created.societyRole, "secretary");
  assert.strictEqual(String(created.societyId), String(society._id));

  // They must be able to sign in immediately — an unapproved secretary
  // could not approve anyone else.
  assert.strictEqual(created.status, "approved");

});


test("a resident from another society cannot be promoted", { skip }, async () => {

  const boss = await makeUser("superadmin", "Cross Boss");
  const { society: a } = await onboard(tokenFor(boss), "Society One");
  const { society: b } = await onboard(tokenFor(boss), "Society Two");

  const outsider = await mongoose.model("User").create({
    name: "Outsider", email: `outsider${unique()}@test.com`, phone: "9581000007",
    societyId: b._id, societyRole: "member", systemRole: "user",
    status: "approved", isVerified: true,
  });

  const res = await request(app)
    .post(`/api/v1/societies/${a._id}/secretary`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ userId: String(outsider._id) });

  assert.strictEqual(res.status, 404, "they do not live in that society");

});


// =======================================================
// SERVICES ON A SOCIETY
//
// The catalogue is shared; attachment is per-society. Detaching must
// never remove the service itself.
// =======================================================

const makeService = (label) =>
  mongoose.model("Service").create({
    name: `${label} ${unique()}`,
    category: "health",
    phone: "9820000001",
    isActive: true,
  });


test("services can be attached to a society after onboarding", { skip }, async () => {

  const boss = await makeUser("superadmin", "Service Boss");
  const { society } = await onboard(tokenFor(boss), "Service Society");

  const a = await makeService("Clinic");
  const b = await makeService("Pharmacy");

  const before = await request(app)
    .get(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(before.body.data.length, 0, "a new society starts with none");

  const added = await request(app)
    .post(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ serviceIds: [String(a._id), String(b._id)] });

  assert.strictEqual(added.status, 201, JSON.stringify(added.body));
  assert.strictEqual(added.body.data.added, 2);

  const after = await request(app)
    .get(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(after.body.data.length, 2);

  // The populate previously asked for "type" and "timing", which the
  // Service model does not have, so every field came back undefined.
  assert.ok(after.body.data[0].name, "the service name comes through");
  assert.ok(after.body.data[0].category, "and its category");

});


test("attaching the same service twice is a no-op", { skip }, async () => {

  const boss = await makeUser("superadmin", "Dupe Boss");
  const { society } = await onboard(tokenFor(boss), "Dupe Society");
  const svc = await makeService("Repeated");

  await request(app)
    .post(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ serviceIds: [String(svc._id)] });

  const again = await request(app)
    .post(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ serviceIds: [String(svc._id)] });

  assert.strictEqual(again.status, 201);
  assert.strictEqual(again.body.data.added, 0);
  assert.strictEqual(again.body.data.alreadyAttached, 1);

  const list = await request(app)
    .get(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(list.body.data.length, 1, "still attached exactly once");

});


test("per-society flags and notes are stored on the link", { skip }, async () => {

  const boss = await makeUser("superadmin", "Flag Boss");
  const { society } = await onboard(tokenFor(boss), "Flag Society");
  const svc = await makeService("Flagged");

  await request(app)
    .post(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ serviceIds: [String(svc._id)] });

  const patched = await request(app)
    .patch(`/api/v1/societies/${society._id}/services/${svc._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ isEmergency: true, notes: "Ask for Ramesh" });

  assert.strictEqual(patched.status, 200, JSON.stringify(patched.body));

  const list = await request(app)
    .get(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  const entry = list.body.data[0];

  assert.strictEqual(entry.isEmergency, true);
  assert.strictEqual(entry.notes, "Ask for Ramesh");

  // The flags belong to the link, not the shared service — another
  // society must not inherit them.
  const service = await mongoose.model("Service").findById(svc._id).lean();
  assert.strictEqual(service.isEmergency, undefined);

});


test("detaching a service leaves it in the catalogue", { skip }, async () => {

  const boss = await makeUser("superadmin", "Detach Boss");
  const { society } = await onboard(tokenFor(boss), "Detach Society");
  const svc = await makeService("Shared");

  await request(app)
    .post(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ serviceIds: [String(svc._id)] });

  const removed = await request(app)
    .delete(`/api/v1/societies/${society._id}/services/${svc._id}`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(removed.status, 200);

  const list = await request(app)
    .get(`/api/v1/societies/${society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(list.body.data.length, 0);

  // Other societies may still be using it.
  assert.ok(
    await mongoose.model("Service").findById(svc._id),
    "the service itself must survive"
  );

});


test("onboarding links the services chosen at step four", { skip }, async () => {

  const boss = await makeUser("superadmin", "Step4 Boss");
  const svc = await makeService("Chosen At Onboarding");

  const stamp = unique();

  const step1 = await request(app)
    .post("/api/v1/onboarding/step1")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      societyName: `Step4 Society ${stamp}`,
      address: "1 Road", city: "Nashik", state: "MH", pincode: "422001",
    });

  const draftId = step1.body.data._id;

  await request(app).post("/api/v1/onboarding/step2")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ draftId, structure: [{ name: "A", totalFloors: 1, flatsPerFloor: 2 }] });

  await request(app).post("/api/v1/onboarding/step3")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({
      draftId,
      secretary: {
        name: "S4 Sec", email: `s4sec${stamp}@test.com`,
        phone: "9581000009", password: "Password123!",
      },
    });

  // step4 stored these and finalize dropped them, so choosing services
  // during onboarding did nothing at all.
  await request(app).post("/api/v1/onboarding/step4")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ draftId, services: [{ serviceId: String(svc._id) }] });

  const done = await request(app).post("/api/v1/onboarding/finalize")
    .set("Authorization", `Bearer ${tokenFor(boss)}`)
    .send({ draftId });

  assert.strictEqual(done.status, 200, JSON.stringify(done.body));

  const list = await request(app)
    .get(`/api/v1/societies/${done.body.data.society._id}/services`)
    .set("Authorization", `Bearer ${tokenFor(boss)}`);

  assert.strictEqual(
    list.body.data.length,
    1,
    "the service picked at step 4 must actually be attached"
  );

});
