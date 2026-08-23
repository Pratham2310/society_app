const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

const app = require("../app");
const mongoose = require("mongoose");

const pushService = require("../services/pushService");

const BACKEND = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(BACKEND, rel), "utf8");

// Assertions about behaviour must ignore comments, or a comment
// explaining a decision reads as the code doing the opposite.
const readCode = (rel) =>
  read(rel)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const withServer = async (fn) => {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
};


// =======================================================
// PUSH TOKENS
// =======================================================

test("only real Expo push tokens are accepted", () => {

  assert.ok(pushService.isExpoToken("ExponentPushToken[abcDEF123]"));

  for (const bad of [
    "",
    null,
    undefined,
    "not-a-token",
    "ExpoPushToken[abc]",
    "ExponentPushToken",
    "ExponentPushToken[]",
    12345,
  ]) {
    assert.ok(
      !pushService.isExpoToken(bad),
      `${JSON.stringify(bad)} must be rejected`
    );
  }

});


test("push tokens live on the user document", () => {

  const User = mongoose.model("User");

  const pushTokens = User.schema.path("pushTokens");

  assert.ok(pushTokens, "User must carry pushTokens");

  const entry = pushTokens.schema;

  assert.ok(entry.path("token"), "each entry needs a token");
  assert.ok(entry.path("platform"), "each entry needs a platform");

});


test("Expo's 100-message batch limit is respected", () => {

  assert.strictEqual(pushService.BATCH_SIZE, 100);

  const source = read("services/pushService.js");

  assert.match(
    source,
    /chunk\(valid, BATCH_SIZE\)/,
    "sends must be chunked, or Expo rejects the request"
  );

});


test("a token Expo reports as dead is pruned", () => {

  const source = read("services/pushService.js");

  assert.match(
    source,
    /DeviceNotRegistered/,
    "dead tokens must be detected"
  );

  assert.match(
    source,
    /pruneTokens/,
    "dead tokens must be removed, or we push into the void forever"
  );

});


test("registering a token releases it from a previous owner", () => {

  const source = read("services/pushService.js");

  // Guards share handsets across shifts. Without this the previous
  // guard keeps receiving the new guard's gate alerts.
  assert.match(
    source,
    /_id:\s*\{\s*\$ne:\s*userId\s*\}/,
    "a re-registered token must be pulled from other users"
  );

});


test("a push failure never breaks the operation that triggered it", () => {

  const source = read("services/notificationService.js");

  assert.match(
    source,
    /try\s*\{[\s\S]*?sendToUsers[\s\S]*?\}\s*catch/,
    "push dispatch must be wrapped — a visitor must still be logged if Expo is down"
  );

});


test("a visitor at the gate notifies the resident", () => {

  const source = read("services/visitorApprovalService.js");

  assert.match(
    source,
    /notificationService\.notify/,
    "requestApproval must notify the resident — this is the point of the feature"
  );

});


test("the notification inbox is scoped to its owner", () => {

  const source = read("services/notificationService.js");

  assert.match(
    source,
    /_id: notificationId, userId: user\.id/,
    "marking read must be scoped by userId, not just notification id"
  );

});


test("device registration is reachable before approval", () => {

  const source = readCode("routes/notificationRoutes.js");

  // A pending resident still needs "your account was approved".
  assert.ok(
    !/checkApproved/.test(source),
    "device registration must not sit behind checkApproved"
  );

});


// =======================================================
// IDEMPOTENCY
// =======================================================

test("gate scans and payments accept an idempotency key", () => {

  for (const [file, what] of [
    ["routes/gateLogRoutes.js", "gate scans"],
    ["routes/paymentRoutes.js", "payments"],
  ]) {
    assert.match(
      read(file),
      /idempotency/,
      `${what} must be idempotent — clients retry on flaky networks`
    );
  }

});


test("idempotency records are unique per user and key", () => {

  const model = mongoose.model("IdempotencyKey");

  const unique = model.schema.indexes().find(
    ([key, options]) =>
      options?.unique && key.userId === 1 && key.key === 1
  );

  assert.ok(
    unique,
    "the unique index is what makes a concurrent double-submit safe"
  );

});


test("idempotency records expire", () => {

  const model = mongoose.model("IdempotencyKey");

  const ttl = model.schema.indexes().find(
    ([, options]) => options?.expireAfterSeconds !== undefined
  );

  assert.ok(ttl, "keys must not accumulate forever");

});


test("the same key on a different endpoint is rejected, not replayed", () => {

  const source = read("middleware/idempotency.js");

  assert.match(
    source,
    /existing\.endpoint !== endpoint/,
    "replaying one endpoint's response for another would be a correctness bug"
  );

});


test("a failed attempt stays retryable", () => {

  const source = read("middleware/idempotency.js");

  assert.match(
    source,
    /res\.statusCode < 400[\s\S]*?deleteOne/,
    "only successes should be replayed; a failure must be retryable with the same key"
  );

});


// =======================================================
// UPLOADS AND VERSIONING
// =======================================================

test("clients can get a signed upload scoped to their society", () => {

  const source = read("routes/uploadRoutes.js");

  assert.match(source, /signature/, "a signed upload endpoint must exist");

  assert.match(
    source,
    /society-app\/\$\{societyId\}/,
    "the signature must pin the folder to the caller's society"
  );

});


test("the client version gate is reachable", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/api/v1/client-version`);

    assert.strictEqual(res.status, 200);

    const body = await res.json();

    // It goes through the envelope like any other response.
    const payload = body.data || body;

    assert.ok(payload.minimumSupported, "must report a minimum version");
    assert.ok(payload.apiVersion, "must report the API version");

  });

});


// =======================================================
// ROLE SEMANTICS
// security guards the gate; secretary is a resident with authority
// =======================================================

test("security is staff, not a resident", () => {

  const R = require("../utils/roles");

  assert.ok(
    !R.RESIDENTS.includes(R.SECURITY),
    "a guard does not live in the society"
  );

  assert.ok(
    !R.COMMITTEE.includes(R.SECURITY),
    "a guard holds no committee authority"
  );

});


test("secretary is a resident who also sits on the committee", () => {

  const R = require("../utils/roles");

  assert.ok(R.RESIDENTS.includes(R.SECRETARY), "a secretary lives in the society");
  assert.ok(R.COMMITTEE.includes(R.SECRETARY), "and holds committee authority");

});


test("guards get gate duties only, never resident or financial powers", () => {

  const dir = path.join(BACKEND, "routes");

  const financial = /notice|complaint|expense|fund|maintenance|payment/i;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {

    const source = readCode(path.join("routes", file));

    for (const line of source.split("\n")) {

      if (!/"security"/.test(line)) continue;

      assert.ok(
        !financial.test(line),
        `${file}: a guard must not be granted "${line.trim().slice(0, 60)}"`
      );

    }

  }

});


test("a guard cannot answer an approval, only raise one", () => {

  const source = readCode("routes/visitorApprovalRoutes.js");

  for (const line of source.split("\n")) {

    if (!/approve|reject/.test(line)) continue;

    assert.ok(
      !/"security"/.test(line),
      "the resident answers; the guard only asks"
    );

  }

});


test("every resident can answer for their own flat", () => {

  const source = readCode("routes/visitorApprovalRoutes.js");

  const approveLine = source
    .split("\n")
    .find((l) => /approvalId\/approve/.test(l));

  // A treasurer or committee member is still a resident with a door.
  for (const role of ["member", "secretary", "treasurer", "committee_member"]) {
    assert.ok(
      approveLine.includes(`"${role}"`),
      `${role} lives here and must be able to approve their own visitor`
    );
  }

});


test("approving is restricted to the resident the visitor came for", () => {

  const source = readCode("services/visitorApprovalService.js");

  assert.match(
    source,
    /validateApprovalOwnership/,
    "society scoping alone would let a neighbour approve a stranger into your flat"
  );

  assert.match(
    source,
    /String\(owner\) !== String\(resident\.id\)/,
    "ownership must be compared against the requesting resident"
  );

});
