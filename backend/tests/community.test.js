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
// EVENTS, NOTICES, HELPLINE, PARKING, PASSWORD RESET
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
  const Event = mongoose.model("Event");
  const Notice = mongoose.model("Notice");

  const societyA = new mongoose.Types.ObjectId();
  const societyB = new mongoose.Types.ObjectId();

  await Society.create([
    { _id: societyA, name: "Com Society A", societyCode: "400001" },
    { _id: societyB, name: "Com Society B", societyCode: "400002" },
  ]);

  const [resident, other, secretary, outsider] = await User.create([
    { name: "Com Res", email: "com-res@test.com", phone: "9400000001",
      societyId: societyA, flatNumber: "A-101",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Com Two", email: "com-two@test.com", phone: "9400000002",
      societyId: societyA, societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Com Sec", email: "com-sec@test.com", phone: "9400000003",
      societyId: societyA, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Com Out", email: "com-out@test.com", phone: "9400000004",
      societyId: societyB, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
  ]);

  const paidEvent = await Event.create({
    societyId: societyA, title: "Diwali Night", eventDate: new Date(Date.now() + 864e5),
    eventType: "Social", fee: 500, createdBy: secretary._id,
  });

  const freeEvent = await Event.create({
    societyId: societyA, title: "AGM", eventDate: new Date(Date.now() + 1728e5),
    createdBy: secretary._id,
  });

  const notice = await Notice.create({
    societyId: societyA, title: "Water shutdown", description: "Tuesday 9am-2pm",
    type: "notice", isUrgent: true, createdBy: secretary._id,
  });

  Object.assign(ids, {
    societyA, societyB, resident, other, secretary, outsider,
    paidEvent, freeEvent, notice,
    tokens: {
      resident: tokenFor(resident),
      other: tokenFor(other),
      secretary: tokenFor(secretary),
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
// EVENTS
// =======================================================

test("RSVP toggles rather than taking a state from the body", { skip }, async () => {

  const on = await request(app)
    .post(`/api/events/${ids.freeEvent._id}/rsvp`)
    .set(as("resident"));

  assert.equal(on.status, 200);
  assert.equal(on.body.data.isAttending, true);
  assert.equal(on.body.data.attendeeCount, 1);

  const off = await request(app)
    .post(`/api/events/${ids.freeEvent._id}/rsvp`)
    .set(as("resident"));

  assert.equal(off.body.data.isAttending, false);
  assert.equal(off.body.data.attendeeCount, 0);

});

test("attendance is per-caller, not global", { skip }, async () => {

  await request(app).post(`/api/events/${ids.freeEvent._id}/rsvp`).set(as("resident"));

  const mine = await request(app)
    .get(`/api/events/${ids.freeEvent._id}`)
    .set(as("resident"));

  const theirs = await request(app)
    .get(`/api/events/${ids.freeEvent._id}`)
    .set(as("other"));

  assert.equal(mine.body.data.isAttending, true);
  assert.equal(theirs.body.data.isAttending, false);
  assert.equal(theirs.body.data.attendeeCount, 1, "the count is shared");

});

test("a free event cannot be paid for", { skip }, async () => {

  const res = await request(app)
    .post(`/api/events/${ids.freeEvent._id}/pay`)
    .set(as("resident"));

  assert.equal(res.status, 400);

});

test("paying implies attending, and cannot happen twice", { skip }, async () => {

  const first = await request(app)
    .post(`/api/events/${ids.paidEvent._id}/pay`)
    .set(as("resident"));

  assert.equal(first.status, 200);
  assert.equal(first.body.data.isPaid, true);
  assert.equal(first.body.data.isAttending, true, "paying is a stronger RSVP");

  const second = await request(app)
    .post(`/api/events/${ids.paidEvent._id}/pay`)
    .set(as("resident"));

  assert.equal(second.status, 409);

  const stored = await mongoose.model("Event").findById(ids.paidEvent._id).lean();

  assert.equal(stored.paidMembers.length, 1);

});

test("the contributor list names who paid", { skip }, async () => {

  const res = await request(app)
    .get(`/api/events/${ids.paidEvent._id}/contributors`)
    .set(as("secretary"));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].name, "Com Res");
  assert.equal(res.body.data[0].amount, 500);

});

test("another society's event is not reachable", { skip }, async () => {

  const res = await request(app)
    .get(`/api/events/${ids.paidEvent._id}`)
    .set(as("outsider"));

  assert.equal(res.status, 404);

});


// =======================================================
// NOTICES
// =======================================================

test("acknowledging twice does not count twice", { skip }, async () => {

  const first = await request(app)
    .post(`/api/notices/${ids.notice._id}/acknowledge`)
    .set(as("resident"));

  assert.equal(first.status, 200);
  assert.equal(first.body.data.acknowledgedCount, 1);

  // Re-reading a notice must not read as an error.
  const second = await request(app)
    .post(`/api/notices/${ids.notice._id}/acknowledge`)
    .set(as("resident"));

  assert.equal(second.status, 200);
  assert.equal(second.body.data.alreadyAcknowledged, true);

  const stored = await mongoose.model("Notice").findById(ids.notice._id).lean();

  assert.equal(stored.acknowledgedBy.length, 1);

});

test("a second resident acknowledging does count", { skip }, async () => {

  const res = await request(app)
    .post(`/api/notices/${ids.notice._id}/acknowledge`)
    .set(as("other"));

  assert.equal(res.body.data.acknowledgedCount, 2);

});


// =======================================================
// HELPLINE
// =======================================================

test("helpline translates label/number to title/phone", { skip }, async () => {

  const res = await request(app)
    .post("/api/helpline")
    .set(as("secretary"))
    .send({ label: "Plumber", number: "9876543210", icon: "maintenance" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.label, "Plumber");
  assert.equal(res.body.data.number, "9876543210");

  const stored = await mongoose.model("Helpline").findById(res.body.data._id).lean();

  assert.equal(stored.title, "Plumber");
  assert.equal(stored.phone, "9876543210");

  ids.contact = res.body.data._id;

});

test("an icon outside the stored enum falls back", { skip }, async () => {

  const res = await request(app)
    .post("/api/helpline")
    .set(as("secretary"))
    .send({ label: "Odd", number: "9876500000", icon: "spaceship" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.icon, "other", "an unknown icon must not lose the contact");

});

test("a resident cannot edit the helpline", { skip }, async () => {

  const res = await request(app)
    .patch(`/api/helpline/${ids.contact}`)
    .set(as("resident"))
    .send({ number: "0000000000" });

  assert.equal(res.status, 403);

});

test("deleting hides rather than destroys", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/helpline/${ids.contact}`)
    .set(as("secretary"));

  assert.equal(res.status, 200);

  const stored = await mongoose.model("Helpline").findById(ids.contact).lean();

  assert.ok(stored, "an old notice may still reference the number");
  assert.equal(stored.isActive, false);

  const list = await request(app).get("/api/helpline").set(as("resident"));

  assert.ok(!list.body.data.some((c) => String(c._id) === String(ids.contact)));

});


// =======================================================
// PARKING
// =======================================================

test("a batch numbers slots and a rerun extends rather than collides", { skip }, async () => {

  const first = await request(app)
    .post("/api/parking/slots/batch")
    .set(as("secretary"))
    .send({ prefix: "p", count: 3, type: "resident" });

  assert.equal(first.status, 201);
  assert.equal(first.body.data.created, 3);
  assert.equal(first.body.data.slots[0].slotNumber, "P-001");

  const second = await request(app)
    .post("/api/parking/slots/batch")
    .set(as("secretary"))
    .send({ prefix: "P", count: 2 });

  assert.equal(second.body.data.created, 2);
  assert.equal(second.body.data.slots[0].slotNumber, "P-004", "numbering continues");

  const all = await request(app).get("/api/parking/slots").set(as("resident"));

  assert.equal(all.body.data.length, 5);

  ids.slot = all.body.data[0]._id;

});

test("a count outside 1..200 is refused", { skip }, async () => {

  for (const count of [0, 201, 2.5]) {
    const res = await request(app)
      .post("/api/parking/slots/batch")
      .set(as("secretary"))
      .send({ prefix: "X", count });

    assert.equal(res.status, 400, `count ${count} should be refused`);
  }

});

test("a resident cannot lay out parking", { skip }, async () => {

  const res = await request(app)
    .post("/api/parking/slots/batch")
    .set(as("resident"))
    .send({ prefix: "Z", count: 1 });

  assert.equal(res.status, 403);

});

test("assigning a plate occupies the slot; clearing it frees it", { skip }, async () => {

  const taken = await request(app)
    .put(`/api/parking/slots/${ids.slot}`)
    .set(as("secretary"))
    .send({ currentVehicleNumber: "mh15 ab 1234" });

  assert.equal(taken.body.data.status, "occupied");
  assert.equal(taken.body.data.currentVehicleNumber, "MH15 AB 1234");

  // An occupied slot cannot be removed — the car would stay put while
  // the allocation vanished.
  const blocked = await request(app)
    .delete(`/api/parking/slots/${ids.slot}`)
    .set(as("secretary"));

  assert.equal(blocked.status, 409);

  const freed = await request(app)
    .put(`/api/parking/slots/${ids.slot}`)
    .set(as("secretary"))
    .send({ currentVehicleNumber: "" });

  assert.equal(freed.body.data.status, "free");
  assert.equal(freed.body.data.currentVehicleNumber, null);

  const removed = await request(app)
    .delete(`/api/parking/slots/${ids.slot}`)
    .set(as("secretary"));

  assert.equal(removed.status, 200);

});

test("the summary counts only this society", { skip }, async () => {

  const mine = await request(app).get("/api/parking/summary").set(as("resident"));

  assert.equal(mine.status, 200);
  assert.equal(mine.body.data.total, 4);
  assert.equal(mine.body.data.canManage, false);

  const theirs = await request(app).get("/api/parking/summary").set(as("outsider"));

  assert.equal(theirs.body.data.total, 0);
  assert.equal(theirs.body.data.canManage, true, "a secretary manages parking");

});


// =======================================================
// PASSWORD RESET
// =======================================================

test("an unknown account gets the same answer as a known one", { skip }, async () => {

  const known = await request(app)
    .post("/api/auth/forgot-password")
    .send({ identifier: "com-res@test.com" });

  const unknown = await request(app)
    .post("/api/auth/forgot-password")
    .send({ identifier: "nobody@nowhere.com" });

  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);

  // Differing here would turn this into a way to test which addresses
  // are registered.
  assert.equal(known.body.message, unknown.body.message);

});

test("a wrong code does not reset the password", { skip }, async () => {

  const before = await mongoose.model("User")
    .findById(ids.resident._id).select("+password tokenVersion").lean();

  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ identifier: "com-res@test.com", otp: "000000", newPassword: "brandnew1" });

  assert.equal(res.status, 400);

  const after = await mongoose.model("User")
    .findById(ids.resident._id).select("+password tokenVersion").lean();

  assert.equal(after.password, before.password);
  assert.equal(after.tokenVersion, before.tokenVersion);

});

test("a short password is refused before the code is checked", { skip }, async () => {

  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ identifier: "com-res@test.com", otp: "123456", newPassword: "abc" });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /6 characters/);

});

test("a real code resets the password and invalidates old sessions", { skip }, async () => {

  const User = mongoose.model("User");

  const sent = await request(app)
    .post("/api/auth/forgot-password")
    .send({ identifier: "com-two@test.com" });

  // Outside production the service hands the code back, which is the
  // only way to walk this without an SMS provider.
  const otp = sent.body.data?.devOtp;

  if (!otp) {
    // A configured SMS provider means no devOtp; the rest of the flow
    // is covered by the failure cases above.
    return;
  }

  const before = await User.findById(ids.other._id)
    .select("+password tokenVersion").lean();

  const res = await request(app)
    .post("/api/auth/reset-password")
    .send({ identifier: "com-two@test.com", otp, newPassword: "a-good-password" });

  assert.equal(res.status, 200);

  const after = await User.findById(ids.other._id)
    .select("+password tokenVersion").lean();

  assert.notEqual(after.password, before.password);
  assert.equal(
    after.tokenVersion, before.tokenVersion + 1,
    "a reset must end sessions opened with the old password"
  );

});
