// =======================================================
// MIGRATION 002 — REPAIR INDEXES
//
// Model changes do not remove indexes that already exist in the
// database, so these have to be dropped explicitly.
//
//   residentsecuritystatuses
//     residentId and societyId were each marked unique on their
//     own, so only ONE resident per society could ever hold a
//     status record. Replaced with a compound unique index.
//     A stray unique userId_1 from an older schema is also dropped.
//
//   maintenancebills
//     userId_1_month_1 omits societyId. Replaced with
//     { societyId, userId, month } so bill generation is idempotent
//     and scoped to one society.
//
// Run with --dry to preview:
//   node backend/scripts/migrations/002-fix-indexes.js --dry
// =======================================================

require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
});

const mongoose = require("mongoose");

const { loadEnv } = require("../../config/env");

const DRY = process.argv.includes("--dry");

const PLAN = [
  {
    collection: "residentsecuritystatuses",
    drop: ["residentId_1", "societyId_1", "userId_1"],
    create: [
      { key: { societyId: 1, residentId: 1 }, options: { unique: true } },
      { key: { societyId: 1 }, options: {} },
    ],
  },
  {
    collection: "maintenancebills",
    drop: ["userId_1_month_1"],
    create: [
      {
        key: { societyId: 1, userId: 1, month: 1 },
        options: { unique: true },
      },
    ],
  },
];

const run = async () => {

  const config = loadEnv();

  await mongoose.connect(config.mongoUri);

  const log = [];

  try {

    for (const step of PLAN) {

      const collection = mongoose.connection.collection(step.collection);

      let existing;

      try {
        existing = await collection.indexes();
      } catch {
        log.push(`${step.collection}: collection does not exist yet — skipped`);
        continue;
      }

      const names = existing.map((i) => i.name);

      // --- refuse to build a unique index over existing duplicates ---
      for (const spec of step.create) {

        if (!spec.options.unique) continue;

        const keys = Object.keys(spec.key);

        const dupes = await collection
          .aggregate([
            {
              $group: {
                _id: keys.reduce((acc, k) => ({ ...acc, [k]: `$${k}` }), {}),
                n: { $sum: 1 },
              },
            },
            { $match: { n: { $gt: 1 } } },
          ])
          .toArray();

        if (dupes.length) {
          log.push(
            `${step.collection}: ABORTED — ${dupes.length} duplicate group(s) ` +
            `for ${JSON.stringify(spec.key)}. Resolve them before rerunning.`
          );
          throw new Error(`duplicates block a unique index on ${step.collection}`);
        }

      }

      // --- drop stale indexes ---
      for (const name of step.drop) {

        if (!names.includes(name)) {
          log.push(`${step.collection}: ${name} already absent`);
          continue;
        }

        log.push(`${step.collection}: DROP ${name}`);

        if (!DRY) {
          await collection.dropIndex(name);
        }

      }

      // --- create the intended ones ---
      for (const spec of step.create) {

        log.push(
          `${step.collection}: CREATE ${JSON.stringify(spec.key)}` +
          `${spec.options.unique ? " UNIQUE" : ""}`
        );

        if (!DRY) {
          await collection.createIndex(spec.key, spec.options);
        }

      }

    }

    console.log(`\n  ${DRY ? "DRY RUN — no changes" : "APPLIED"}\n`);
    for (const line of log) {
      console.log(`   ${line}`);
    }
    console.log("");

  } finally {

    await mongoose.connection.close();

  }

};

run().catch((error) => {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
});
