const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

require("../app");

const mongoose = require("mongoose");

const BACKEND = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(BACKEND, rel), "utf8");

// Assertions about what the code *does* must ignore comments, or a
// comment explaining a fix reads as the bug it describes.
const readCode = (rel) =>
  read(rel)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const indexesOf = (modelName) => mongoose.model(modelName).schema.indexes();

const hasIndex = (modelName, keys, opts = {}) =>
  indexesOf(modelName).some(([key, options]) => {
    const keyMatch =
      Object.keys(keys).length === Object.keys(key).length &&
      Object.entries(keys).every(([k, v]) => key[k] === v);
    const optMatch = Object.entries(opts).every(
      ([k, v]) => options?.[k] === v
    );
    return keyMatch && optMatch;
  });


test("one security status per resident per society, not one per society", () => {

  const model = mongoose.model("ResidentSecurityStatus");

  // The original bug: each field unique on its own capped the whole
  // society at a single status record.
  for (const field of ["residentId", "societyId"]) {
    assert.notStrictEqual(
      model.schema.path(field).options.unique,
      true,
      `${field} must not be unique on its own`
    );
  }

  assert.ok(
    hasIndex("ResidentSecurityStatus", { societyId: 1, residentId: 1 }, { unique: true }),
    "expected a compound unique index on { societyId, residentId }"
  );

});


test("bill generation is protected by a per-period unique index", () => {

  assert.ok(
    hasIndex("MaintenanceBill", { societyId: 1, userId: 1, month: 1 }, { unique: true }),
    "expected a unique index on { societyId, userId, month }"
  );

});


test("repeat bill generation skips duplicates instead of aborting", () => {

  const repo = read("repository/maintenanceRepository.js");

  assert.ok(
    /ordered:\s*false/.test(repo),
    "insertMany must be unordered so one duplicate does not abort the batch"
  );

  assert.ok(
    /11000/.test(repo),
    "duplicate-key errors must be handled, not thrown"
  );

});


test("CommunityFund is registered under the name its refs use", () => {

  const ref = mongoose.model("Contribution").schema.path("fundId").options.ref;

  assert.strictEqual(ref, "CommunityFund");

  assert.ok(
    mongoose.modelNames().includes(ref),
    `Contribution.fundId references "${ref}" but no such model is registered — populate would fail`
  );

});


test("gate log retention is opt-in and off by default", () => {

  const source = read("models/GateLog.js");

  assert.ok(
    /GATE_LOG_RETENTION_DAYS/.test(source),
    "retention must be configurable"
  );

  // Deleting a society's visitor history should never be a silent default.
  assert.ok(
    /retentionDays\s*>\s*0/.test(source),
    "the TTL index must only be created when retention is explicitly set"
  );

  const ttlIndexes = indexesOf("GateLog").filter(
    ([, options]) => options?.expireAfterSeconds !== undefined
  );

  if (!process.env.GATE_LOG_RETENTION_DAYS) {
    assert.strictEqual(
      ttlIndexes.length,
      0,
      "no TTL index should exist when retention is unset"
    );
  }

});


test("multi-document writes run inside a transaction", () => {

  const flows = [
    ["services/paymentServices.js", "payment and bill status"],
    ["services/parkingService.js", "allotment and slot status"],
    ["services/communityFundService.js", "contribution and fund total"],
  ];

  for (const [file, description] of flows) {

    const source = read(file);

    assert.ok(
      /withTransaction\(/.test(source),
      `${description} must be atomic (${file})`
    );

  }

});


test("fund totals move by atomic increment, not read-modify-write", () => {

  const repo = readCode("repository/communityFundRepository.js");
  const service = readCode("services/communityFundService.js");

  assert.ok(
    /\$inc/.test(repo),
    "collectedAmount must use $inc so concurrent approvals cannot clobber each other"
  );

  assert.ok(
    !/collectedAmount\s*\+=/.test(service),
    "the read-modify-write on collectedAmount must be gone"
  );

});


test("no service calls .save() on a lean document", () => {

  // findContributionById returns a lean object, so contribution.save()
  // threw at runtime. Guard the specific regression.
  const service = readCode("services/communityFundService.js");

  assert.ok(
    !/contribution\.save\(\)/.test(service),
    "lean objects have no .save()"
  );

});


test("the visitor approval repository is a repository, not a model", () => {

  const repo = require("../repository/visitorApprovalRepository");

  assert.ok(
    !(repo.schema && repo.modelName),
    "it must not export a Mongoose model — that silently bypasses tenant scoping"
  );

  const required = [
    "create", "findById", "findResidentPending", "findGuardPending",
    "approve", "reject", "cancel", "expire", "attachGuestPass",
    "existsPending", "countPending", "countApproved", "countRejected",
    "countExpired", "countTotal",
  ];

  for (const method of required) {
    assert.strictEqual(
      typeof repo[method],
      "function",
      `visitorApprovalRepository must export ${method}`
    );
  }

});


test("the visitor approval repository scopes lookups by society", () => {

  const source = readCode("repository/visitorApprovalRepository.js");

  assert.ok(
    /_id:\s*id,\s*societyId/s.test(source),
    "buildFilter must constrain on societyId as well as _id"
  );

  assert.ok(
    !/mongoose\.model\(/.test(source),
    "the duplicated model definition must be gone"
  );

});
