// =======================================================
// MIGRATION 001 — NORMALISE ROLE DATA
//
// Two problems in existing documents:
//
//   1. Values: "comitee-member", "commitee_member", "guard" and
//      "admin" were written by older code. None are in the schema
//      enum, so those users match no role check.
//
//   2. Field name: code wrote `societyrole` (lowercase r) while the
//      schema declares `societyRole`. Mongoose strict mode silently
//      dropped those writes, so some documents carry the stray field
//      and a stale or missing societyRole.
//
// Run with --dry to preview:
//   node backend/scripts/migrations/001-normalise-roles.js --dry
//   node backend/scripts/migrations/001-normalise-roles.js
// =======================================================

require("dotenv").config({
  path: require("path").join(__dirname, "..", "..", ".env"),
});

const mongoose = require("mongoose");

const { loadEnv } = require("../../config/env");
const { LEGACY_ALIASES, SOCIETY_ROLE_VALUES } = require("../../utils/roles");

const DRY = process.argv.includes("--dry");

const run = async () => {

  const config = loadEnv();

  await mongoose.connect(config.mongoUri);

  // Work on the raw collection: the documents we are fixing are
  // exactly the ones the schema would reject.
  const users = mongoose.connection.collection("users");

  const report = [];

  try {

    // --- 1. stray lowercase `societyrole` field -----------------
    const strays = await users
      .find({ societyrole: { $exists: true } })
      .toArray();

    for (const doc of strays) {

      const stray = doc.societyrole;
      const canonical = LEGACY_ALIASES[stray] || stray;

      const valid = SOCIETY_ROLE_VALUES.includes(canonical);

      // Only promote the stray value if the real field is unset or
      // still the default — never clobber a deliberate role.
      const shouldPromote =
        valid && (!doc.societyRole || doc.societyRole === "member");

      report.push({
        _id: doc._id,
        action: shouldPromote
          ? `societyrole:"${stray}" -> societyRole:"${canonical}"`
          : `drop stray societyrole:"${stray}" (keeping societyRole:"${doc.societyRole}")`,
      });

      if (!DRY) {

        const update = { $unset: { societyrole: "" } };

        if (shouldPromote) {
          update.$set = { societyRole: canonical };
        }

        await users.updateOne({ _id: doc._id }, update);

      }

    }

    // --- 2. legacy values in the correct field ------------------
    for (const [legacy, canonical] of Object.entries(LEGACY_ALIASES)) {

      const matches = await users
        .find({ societyRole: legacy })
        .toArray();

      for (const doc of matches) {
        report.push({
          _id: doc._id,
          action: `societyRole:"${legacy}" -> "${canonical}"`,
        });
      }

      if (!DRY && matches.length) {
        await users.updateMany(
          { societyRole: legacy },
          { $set: { societyRole: canonical } }
        );
      }

    }

    // --- 3. anything left that the schema would reject ----------
    const invalid = await users
      .find({
        societyRole: { $exists: true, $nin: [...SOCIETY_ROLE_VALUES, null] },
      })
      .toArray();

    for (const doc of invalid) {
      report.push({
        _id: doc._id,
        action: `WARNING unrecognised societyRole:"${doc.societyRole}" — left untouched, fix manually`,
      });
    }

    // --- summary ------------------------------------------------
    console.log(`\n  ${DRY ? "DRY RUN — no writes" : "APPLIED"}`);
    console.log(`  ${report.length} document(s) affected\n`);

    for (const row of report) {
      console.log(`   ${row._id}  ${row.action}`);
    }

    if (!report.length) {
      console.log("   nothing to migrate");
    }

    console.log("");

  } finally {

    await mongoose.connection.close();

  }

};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
