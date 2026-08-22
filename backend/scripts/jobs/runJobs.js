// =======================================================
// SCHEDULED JOBS
//
// Work that is time-based rather than request-based: passes that
// should have expired, approvals nobody answered, OTP material
// past its window.
//
// Run as Render Cron Jobs rather than an in-process scheduler.
// An in-process timer runs once per instance, so it fires twice
// the moment you scale to two — and these jobs must not double up.
//
//   node backend/scripts/jobs/runJobs.js            all jobs
//   node backend/scripts/jobs/runJobs.js expirePasses  one job
//   node backend/scripts/jobs/runJobs.js --dry       report only
//
// Every job is idempotent: running it twice changes nothing the
// second time, which is what makes a missed or repeated cron safe.
// =======================================================

require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
});

require("../../models/plugins/register");

const mongoose = require("mongoose");

const { loadEnv } = require("../../config/env");
const logger = require("../../utils/logger");

const DRY = process.argv.includes("--dry");

// =======================================================
// JOBS
// =======================================================

const expirePasses = async () => {

  const GuestPass = require("../../models/GuestPass");

  const filter = {
    status: "active",
    expiryDate: { $lt: new Date() },
  };

  const count = await GuestPass.countDocuments(filter);

  if (!DRY && count) {
    await GuestPass.updateMany(filter, {
      $set: { status: "expired", expiredAt: new Date() },
    });
  }

  return { job: "expirePasses", affected: count };

};

const expireVisitorApprovals = async () => {

  const VisitorApproval = require("../../models/VisitorApproval");

  const filter = {
    approvalStatus: "pending",
    expiresAt: { $lt: new Date() },
  };

  const count = await VisitorApproval.countDocuments(filter);

  if (!DRY && count) {
    await VisitorApproval.updateMany(filter, {
      $set: { approvalStatus: "expired", respondedAt: new Date() },
    });
  }

  return { job: "expireVisitorApprovals", affected: count };

};

const cleanupOtps = async () => {

  const User = require("../../models/User");

  // The TTL index handles this in normal operation; this is the
  // backstop for documents written before the index existed.
  const filter = {
    otpExpires: { $lt: new Date() },
    otpHash: { $exists: true },
  };

  const count = await User.countDocuments(filter);

  if (!DRY && count) {
    await User.updateMany(filter, {
      $unset: { otpHash: "", otpExpires: "", otpAttempts: "" },
    });
  }

  return { job: "cleanupOtps", affected: count };

};

const pruneIdempotencyKeys = async () => {

  const IdempotencyKey = require("../../models/IdempotencyKey");

  // A key stuck in_progress means the process died mid-request.
  // Leaving it blocks the client from ever retrying.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);

  const filter = { status: "in_progress", createdAt: { $lt: cutoff } };

  const count = await IdempotencyKey.countDocuments(filter);

  if (!DRY && count) {
    await IdempotencyKey.deleteMany(filter);
  }

  return { job: "pruneIdempotencyKeys", affected: count };

};

const JOBS = {
  expirePasses,
  expireVisitorApprovals,
  cleanupOtps,
  pruneIdempotencyKeys,
};

// =======================================================
// RUNNER
// =======================================================

const run = async () => {

  const config = loadEnv();

  const requested = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--"));

  const names = requested.length ? requested : Object.keys(JOBS);

  for (const name of names) {
    if (!JOBS[name]) {
      logger.error({ job: name }, "Unknown job");
      process.exit(1);
    }
  }

  await mongoose.connect(config.mongoUri);

  const results = [];
  let failed = 0;

  try {

    for (const name of names) {

      const startedAt = Date.now();

      try {

        const result = await JOBS[name]();

        results.push({ ...result, ms: Date.now() - startedAt });

        logger.info(
          { ...result, ms: Date.now() - startedAt, dry: DRY },
          `job ${name} finished`
        );

      } catch (error) {

        failed += 1;

        // One failing job must not stop the rest.
        logger.error({ err: error, job: name }, `job ${name} failed`);

        results.push({ job: name, error: error.message });

      }

    }

  } finally {

    await mongoose.connection.close();

  }

  console.log(`\n  ${DRY ? "DRY RUN" : "APPLIED"}`);
  for (const r of results) {
    console.log(
      `   ${r.job.padEnd(24)} ${r.error ? `FAILED: ${r.error}` : `${r.affected} affected`}`
    );
  }
  console.log("");

  process.exit(failed ? 1 : 0);

};

//Only run when invoked directly. Importing this module (the tests do,
//to exercise the jobs against a real database) must not start a run
//or call process.exit.
if (require.main === module) {

  run().catch((error) => {
    logger.error({ err: error }, "Job runner failed");
    process.exit(1);
  });

}

module.exports = { JOBS, run };
