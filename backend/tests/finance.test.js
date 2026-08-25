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
// FINANCE
//
// The money surface, so the tests that matter are the ones about who
// may move a total and whether the totals stay consistent when they
// do.
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
    { _id: societyA, name: "Fin Society A", societyCode: "300001" },
    { _id: societyB, name: "Fin Society B", societyCode: "300002" },
  ]);

  const [resident, treasurer, secretary, otherTreasurer] = await User.create([
    { name: "Fin Res", email: "fin-res@test.com", phone: "9300000001",
      societyId: societyA, flatNumber: "A-101",
      societyRole: "member", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Fin Tre", email: "fin-tre@test.com", phone: "9300000002",
      societyId: societyA, societyRole: "treasurer", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Fin Sec", email: "fin-sec@test.com", phone: "9300000003",
      societyId: societyA, societyRole: "secretary", systemRole: "user",
      status: "approved", isVerified: true },
    { name: "Fin Tre B", email: "fin-treb@test.com", phone: "9300000004",
      societyId: societyB, societyRole: "treasurer", systemRole: "user",
      status: "approved", isVerified: true },
  ]);

  Object.assign(ids, {
    societyA, societyB, resident, treasurer, secretary, otherTreasurer,
    tokens: {
      resident: tokenFor(resident),
      treasurer: tokenFor(treasurer),
      secretary: tokenFor(secretary),
      otherTreasurer: tokenFor(otherTreasurer),
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
// FUND CAMPAIGNS
// =======================================================

test("a resident cannot open a fund", { skip }, async () => {

  const res = await request(app)
    .post("/api/finance/campaigns")
    .set(as("resident"))
    .send({ title: "Slush Fund", goal: 100000 });

  assert.equal(res.status, 403);

});

test("a fund is stored as targetAmount but read back as goal", { skip }, async () => {

  const res = await request(app)
    .post("/api/finance/campaigns")
    .set(as("treasurer"))
    .send({ title: "New Gate", goal: 50000, description: "Replace the barrier" });

  assert.equal(res.status, 201);

  // The app reads goal/raised/progress; the model has always stored
  // targetAmount/collectedAmount. The translation is the point.
  assert.equal(res.body.data.goal, 50000);
  assert.equal(res.body.data.raised, 0);
  assert.equal(res.body.data.progress, 0);

  const stored = await mongoose.model("CommunityFund")
    .findById(res.body.data._id).lean();

  assert.equal(stored.targetAmount, 50000);

  ids.fund = res.body.data._id;

});

test("a fund with no goal reports 0 progress, not Infinity", { skip }, async () => {

  const CommunityFund = mongoose.model("CommunityFund");

  const odd = await CommunityFund.create({
    societyId: ids.societyA,
    title: "Unbounded",
    targetAmount: 0,
    collectedAmount: 500,
    createdBy: ids.treasurer._id,
  });

  const res = await request(app)
    .get("/api/finance/campaigns")
    .set(as("resident"));

  const found = res.body.data.find((f) => String(f._id) === String(odd._id));

  assert.equal(found.progress, 0);
  assert.ok(Number.isFinite(found.progress));

  await CommunityFund.deleteOne({ _id: odd._id });

});


// =======================================================
// CONTRIBUTIONS
// =======================================================

test("a resident saying they paid does not move the total", { skip }, async () => {

  const res = await request(app)
    .post("/api/finance/contributions")
    .set(as("resident"))
    .send({ fundId: ids.fund, amount: 5000, status: "paid" });

  assert.equal(res.status, 201);

  // The app sends status:'paid'. Trusting it would let any resident
  // inflate the fund from their phone.
  assert.equal(res.body.data.status, "pending");

  const fund = await mongoose.model("CommunityFund").findById(ids.fund).lean();

  assert.equal(fund.collectedAmount, 0, "unverified money must not count");

  ids.contribution = res.body.data._id;

});

test("only the treasurer sees the unverified queue", { skip }, async () => {

  const resident = await request(app)
    .get(`/api/finance/campaigns/${ids.fund}/contributions`)
    .set(as("resident"));

  assert.equal(resident.status, 200);
  assert.equal(resident.body.data.pending.length, 0);
  assert.equal(resident.body.data.canManage, false);

  const treasurer = await request(app)
    .get(`/api/finance/campaigns/${ids.fund}/contributions`)
    .set(as("treasurer"));

  assert.equal(treasurer.body.data.pending.length, 1);
  assert.equal(treasurer.body.data.pendingTotal, 5000);
  assert.equal(treasurer.body.data.canManage, true);

});

test("a secretary manages funds but does not verify money", { skip }, async () => {

  // finance.manage and finance.verify are deliberately separate: the
  // secretary can open a fund, only the treasurer confirms a payment.
  const res = await request(app)
    .patch(`/api/finance/contributions/${ids.contribution}/verify`)
    .set(as("secretary"));

  assert.equal(res.status, 403);

});

test("verifying moves the fund total with it", { skip }, async () => {

  const res = await request(app)
    .patch(`/api/finance/contributions/${ids.contribution}/verify`)
    .set(as("treasurer"));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "approved");
  assert.ok(res.body.data.receiptNo, "an approved contribution gets a receipt");

  const fund = await mongoose.model("CommunityFund").findById(ids.fund).lean();

  assert.equal(fund.collectedAmount, 5000);

});

test("the same contribution cannot be verified twice", { skip }, async () => {

  const res = await request(app)
    .patch(`/api/finance/contributions/${ids.contribution}/verify`)
    .set(as("treasurer"));

  assert.equal(res.status, 400);

  const fund = await mongoose.model("CommunityFund").findById(ids.fund).lean();

  assert.equal(fund.collectedAmount, 5000, "the total must not double");

});

test("another society's treasurer cannot verify or read", { skip }, async () => {

  const verify = await request(app)
    .patch(`/api/finance/contributions/${ids.contribution}/verify`)
    .set(as("otherTreasurer"));

  assert.equal(verify.status, 404);

  const read = await request(app)
    .get(`/api/finance/campaigns/${ids.fund}/contributions`)
    .set(as("otherTreasurer"));

  assert.equal(read.status, 404);

});


// =======================================================
// RECEIPTS
// =======================================================

test("a receipt is the payer's or the treasurer's, nobody else's", { skip }, async () => {

  const mine = await request(app)
    .get(`/api/finance/contributions/${ids.contribution}/receipt`)
    .set(as("resident"));

  assert.equal(mine.status, 200);
  assert.equal(mine.body.data.amount, 5000);
  assert.equal(mine.body.data.resident.name, "Fin Res");

  const treasurer = await request(app)
    .get(`/api/finance/contributions/${ids.contribution}/receipt`)
    .set(as("treasurer"));

  assert.equal(treasurer.status, 200);

  const stranger = await request(app)
    .get(`/api/finance/contributions/${ids.contribution}/receipt`)
    .set(as("secretary"));

  assert.equal(stranger.status, 403, "a receipt names a resident and a sum");

});

test("an unverified contribution has no receipt", { skip }, async () => {

  const pending = await request(app)
    .post("/api/finance/contributions")
    .set(as("resident"))
    .send({ fundId: ids.fund, amount: 100 });

  const res = await request(app)
    .get(`/api/finance/contributions/${pending.body.data._id}/receipt`)
    .set(as("resident"));

  assert.equal(res.status, 409);

});


// =======================================================
// DELETING A FUND PEOPLE PAID INTO
// =======================================================

test("a fund with verified money cannot be deleted", { skip }, async () => {

  const res = await request(app)
    .delete(`/api/finance/campaigns/${ids.fund}`)
    .set(as("treasurer"));

  assert.equal(res.status, 409);

  const still = await mongoose.model("CommunityFund").findById(ids.fund).lean();

  assert.ok(still, "deleting would orphan the contributions");

});

test("an untouched fund deletes cleanly", { skip }, async () => {

  const created = await request(app)
    .post("/api/finance/campaigns")
    .set(as("treasurer"))
    .send({ title: "Mistake", goal: 1000 });

  const res = await request(app)
    .delete(`/api/finance/campaigns/${created.body.data._id}`)
    .set(as("treasurer"));

  assert.equal(res.status, 200);

});


// =======================================================
// EXPENSES
// =======================================================

test("the app's 'receipt' lands in the model's billFile", { skip }, async () => {

  const res = await request(app)
    .post("/api/finance/expenses")
    .set(as("treasurer"))
    .send({
      title: "Lift repair", amount: 12000,
      category: "maintenance", receipt: "https://example.com/bill.pdf",
    });

  assert.equal(res.status, 201);

  const stored = await mongoose.model("Expense").findById(res.body.data._id).lean();

  assert.equal(stored.billFile, "https://example.com/bill.pdf");

  ids.expense = res.body.data._id;

});

test("an unknown category falls back rather than failing", { skip }, async () => {

  const res = await request(app)
    .post("/api/finance/expenses")
    .set(as("treasurer"))
    .send({ title: "Odd one", amount: 500, category: "not-a-category" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.category, "other");

});

test("a zero or negative expense is refused", { skip }, async () => {

  for (const amount of [0, -100, "abc"]) {
    const res = await request(app)
      .post("/api/finance/expenses")
      .set(as("treasurer"))
      .send({ title: "Bad", amount });

    assert.equal(res.status, 400, `amount ${amount} should be refused`);
  }

});

test("a resident cannot add or delete an expense", { skip }, async () => {

  const create = await request(app)
    .post("/api/finance/expenses")
    .set(as("resident"))
    .send({ title: "Sneaky", amount: 100 });

  assert.equal(create.status, 403);

  const remove = await request(app)
    .delete(`/api/finance/expenses/${ids.expense}`)
    .set(as("resident"));

  assert.equal(remove.status, 403);

});


// =======================================================
// MAINTENANCE
// =======================================================

test("the due day is capped so February still has one", { skip }, async () => {

  const bad = await request(app)
    .put("/api/finance/maintenance/amount")
    .set(as("treasurer"))
    .send({ amount: 2500, dueDay: 31 });

  assert.equal(bad.status, 400);

  const ok = await request(app)
    .put("/api/finance/maintenance/amount")
    .set(as("treasurer"))
    .send({ amount: 2500, dueDay: 5 });

  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.amount, 2500);
  assert.equal(ok.body.data.dueDay, 5);

});

test("the hub is committee-only", { skip }, async () => {

  const res = await request(app)
    .get("/api/finance/maintenance/hub")
    .set(as("resident"));

  assert.equal(res.status, 403);

});

test("a resident's maintenance list is their own bills only", { skip }, async () => {

  const MaintenanceBill = mongoose.model("MaintenanceBill");

  await MaintenanceBill.create([
    { societyId: ids.societyA, userId: ids.resident._id, flatNumber: "A-101",
      month: "March 2026", amount: 2500, status: "pending" },
    { societyId: ids.societyA, userId: ids.treasurer._id, flatNumber: "A-102",
      month: "March 2026", amount: 2500, status: "paid" },
  ]);

  const resident = await request(app)
    .get("/api/finance/maintenance")
    .set(as("resident"));

  assert.equal(resident.body.data.length, 1);
  assert.equal(resident.body.data[0].flatNumber, "A-101");

  // The treasurer sees the whole society through the same route.
  const treasurer = await request(app)
    .get("/api/finance/maintenance")
    .set(as("treasurer"));

  assert.equal(treasurer.body.data.length, 2);

});

test("reminders go once per resident, not once per bill", { skip }, async () => {

  const MaintenanceBill = mongoose.model("MaintenanceBill");

  // The same resident, three months behind.
  await MaintenanceBill.create([
    { societyId: ids.societyA, userId: ids.resident._id, flatNumber: "A-101",
      month: "January 2026", amount: 2500, status: "pending" },
    { societyId: ids.societyA, userId: ids.resident._id, flatNumber: "A-101",
      month: "February 2026", amount: 2500, status: "pending" },
  ]);

  const res = await request(app)
    .post("/api/finance/maintenance/reminders")
    .set(as("treasurer"));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.outstanding, 3, "three bills are outstanding");
  assert.equal(res.body.data.reminded, 1, "but only one resident owes them");

});


// =======================================================
// OVERVIEW
// =======================================================

test("the overview owes what this resident owes, not the society", { skip }, async () => {

  const resident = await request(app)
    .get("/api/finance/overview")
    .set(as("resident"));

  assert.equal(resident.status, 200);
  assert.equal(resident.body.data.dueAmount, 7500, "three pending bills of 2500");

  const treasurer = await request(app)
    .get("/api/finance/overview")
    .set(as("treasurer"));

  assert.equal(treasurer.body.data.dueAmount, 0, "the treasurer's own bill is paid");

});

test("the activity feed says 'paid', which the app keys its icon on", { skip }, async () => {

  const res = await request(app)
    .get("/api/finance/overview")
    .set(as("resident"));

  const contribution = res.body.data.activities.find((a) =>
    a.title.toLowerCase().includes("paid")
  );

  assert.ok(contribution, "a verified contribution must read as paid");
  assert.equal(contribution.amount, 5000);

});

test("the contributor wall does not cross societies", { skip }, async () => {

  const mine = await request(app)
    .get("/api/finance/contributors")
    .set(as("resident"));

  assert.equal(mine.status, 200);
  assert.equal(mine.body.data.length, 1);
  assert.equal(mine.body.data[0].name, "Fin Res");

  const theirs = await request(app)
    .get("/api/finance/contributors")
    .set(as("otherTreasurer"));

  assert.equal(theirs.body.data.length, 0);

});
