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
const logger = require("../utils/logger");
const sentry = require("../config/sentry");
const { JOBS } = require("../scripts/jobs/runJobs");

const BACKEND = path.join(__dirname, "..");

const sourceFiles = (dir, acc = []) => {

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {

    if (entry.name === "node_modules") continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["tests", "scripts"].includes(entry.name)) continue;
      sourceFiles(full, acc);
      continue;
    }

    if (entry.name.endsWith(".js")) acc.push(full);

  }

  return acc;

};

const codeOf = (file) =>
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");


// =======================================================
// LOGGING
// =======================================================

test("application code logs through the logger, not the console", () => {

  // config/env.js runs before the logger exists — it validates the
  // configuration the logger itself would need.
  const ALLOWED = new Set([
    path.join(BACKEND, "config", "env.js"),
    path.join(BACKEND, "utils", "logger.js"),
    path.join(BACKEND, "seedDatabase.js"),
    path.join(BACKEND, "connectModels.js"),
  ]);

  const offenders = [];

  for (const file of sourceFiles(BACKEND)) {

    if (ALLOWED.has(file)) continue;

    const code = codeOf(file);

    if (/console\.(log|error|warn|info|debug)\s*\(/.test(code)) {
      offenders.push(path.relative(BACKEND, file));
    }

  }

  assert.deepStrictEqual(
    offenders,
    [],
    `these still use console: ${offenders.join(", ")}`
  );

});


test("the logger redacts anything that could be a credential", () => {

  const paths = logger.REDACT_PATHS.join(" ");

  for (const secret of [
    "authorization",
    "password",
    "otp",
    "token",
    "MONGO_URI",
    "JWT_SECRET",
  ]) {
    assert.ok(
      paths.includes(secret),
      `${secret} must be redacted — earlier phases found each of these in logs`
    );
  }

});


test("logs carry a service name so they can be filtered", () => {

  assert.ok(logger.bindings().service, "log lines must identify the service");

});


// =======================================================
// ERROR TRACKING
// =======================================================

test("Sentry is optional and inert without a DSN", () => {

  // CI and local development must not need an account.
  assert.strictEqual(
    typeof sentry.init,
    "function"
  );

  assert.strictEqual(
    sentry.isEnabled(),
    false,
    "with no SENTRY_DSN configured, tracking must be a no-op"
  );

  // Must not throw when disabled.
  sentry.captureException(new Error("test"), { requestId: "x" });

});


test("Sentry is configured not to send request bodies", () => {

  const source = fs.readFileSync(
    path.join(BACKEND, "config", "sentry.js"),
    "utf8"
  );

  assert.match(
    source,
    /sendDefaultPii:\s*false/,
    "Sentry's defaults would attach bodies and headers carrying secrets"
  );

  assert.match(source, /beforeSend/, "events must be scrubbed before sending");

});


test("the error handler only reports 5xx to Sentry", () => {

  const source = codeOf(path.join(BACKEND, "middleware", "errorHandler.js"));

  // A 404 is the API working. Reporting it trains people to ignore alerts.
  assert.match(
    source,
    /statusCodeForLog >= 500[\s\S]*?captureException/,
    "only server errors should raise an alert"
  );

});


// =======================================================
// AUDIT
// =======================================================

test("the audit log records who, what, and to what", () => {

  const model = mongoose.model("AuditLog");

  for (const field of ["actorId", "action", "targetId", "targetType", "societyId"]) {
    assert.ok(model.schema.path(field), `audit entries need ${field}`);
  }

  assert.ok(
    model.schema.path("requestId"),
    "entries must tie back to the request logs"
  );

});


test("audit failures never break the audited action", () => {

  const source = codeOf(path.join(BACKEND, "services", "auditService.js"));

  assert.match(
    source,
    /try\s*\{[\s\S]*?AuditLog\.create[\s\S]*?\}\s*catch/,
    "refusing a payment because the audit write failed would be worse than the gap"
  );

});


test("money and role changes are audited", () => {

  const audit = require("../services/auditService");

  for (const action of [
    "PAYMENT_RECORDED",
    "USER_ROLE_CHANGED",
    "USER_STATUS_CHANGED",
  ]) {
    assert.ok(audit.ACTIONS[action], `${action} must be an auditable action`);
  }

  const payments = codeOf(path.join(BACKEND, "controllers", "paymentController.js"));
  const users = codeOf(path.join(BACKEND, "controllers", "userController.js"));

  assert.match(payments, /audit\.record/, "payments must be audited");
  assert.match(users, /audit\.record/, "role and status changes must be audited");

});


// =======================================================
// SCHEDULED JOBS
// =======================================================

test("the jobs a cron needs to call all exist", () => {

  for (const name of [
    "expirePasses",
    "expireVisitorApprovals",
    "cleanupOtps",
    "pruneIdempotencyKeys",
  ]) {
    assert.strictEqual(typeof JOBS[name], "function", `${name} must be runnable`);
  }

});


test("importing the job runner does not run it", () => {

  const source = codeOf(path.join(BACKEND, "scripts", "jobs", "runJobs.js"));

  // It calls process.exit; importing it in a test would kill the run.
  assert.match(
    source,
    /require\.main === module/,
    "the runner must only execute when invoked directly"
  );

});


test("jobs run as cron, not on an in-process timer", () => {

  const source = fs.readFileSync(
    path.join(BACKEND, "scripts", "jobs", "runJobs.js"),
    "utf8"
  );

  assert.match(
    source,
    /Render Cron Jobs/,
    "an in-process scheduler fires once per instance and doubles up when scaled"
  );

});
