// =======================================================
// ONE-TIME SUPERADMIN BOOTSTRAP
//
// Replaces the old public POST /api/admin/create-superadmin
// route, which let anyone on the internet mint a superadmin.
//
// Usage:
//   npm run bootstrap:superadmin -- --email a@b.com --name "A B" --phone 9999999999
//
// The password is read from the SUPERADMIN_PASSWORD environment
// variable so it never lands in shell history or process listings.
// Refuses to run if a superadmin already exists.
// =======================================================

require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const { loadEnv } = require("../config/env");
const User = require("../models/User");

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

const run = async () => {

  const config = loadEnv();

  const email = arg("email");
  const name = arg("name");
  const phone = arg("phone");
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !name || !phone) {
    fail(
      "Usage: npm run bootstrap:superadmin -- --email <email> --name <name> --phone <phone>"
    );
  }

  if (!password || password.length < 12) {
    fail(
      "Set SUPERADMIN_PASSWORD (at least 12 characters) in the environment before running."
    );
  }

  await mongoose.connect(config.mongoUri);

  try {

    const existing = await User.findOne({ systemRole: "superadmin" });

    if (existing) {
      fail(
        `A superadmin already exists (${existing.email}). ` +
        `Refusing to create another. Remove it first if this is intentional.`
      );
    }

    const duplicate = await User.findOne({ email: email.toLowerCase() });

    if (duplicate) {
      fail(`A user with the email ${email} already exists.`);
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: await bcrypt.hash(password, 12),
      systemRole: "superadmin",
      status: "approved",
      isVerified: true,
      isOnboarded: true,
    });

    console.log(`\n  Superadmin created: ${user.email}\n`);

  } finally {

    await mongoose.connection.close();

  }

};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
