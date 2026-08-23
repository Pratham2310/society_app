const mongoose = require("mongoose");
const crypto = require("node:crypto");

// =======================================================
// INTEGRATION TEST DATABASE
//
// Integration tests run against a real MongoDB, because the bugs
// worth catching here only appear against one: the gate scan
// wingId failure survived 78 structural tests and surfaced the
// first time a real document was written.
//
// Each run gets its own database name and drops it afterwards, so
// tests never touch development data.
//
// TEST_MONGO_URI overrides the target. Falling back to MONGO_URI is
// safe because the database NAME is always replaced.
// =======================================================

const suffix = crypto.randomBytes(4).toString("hex");
const DB_NAME = `society-app-test-${suffix}`;

let connected = false;

const uriFor = (dbName) => {

  const base = process.env.TEST_MONGO_URI || process.env.MONGO_URI;

  if (!base) {
    throw new Error("Set MONGO_URI or TEST_MONGO_URI to run integration tests");
  }

  // Replace the database segment, preserving query options.
  const [head, query] = base.split("?");
  const withoutDb = head.replace(/\/[^/]*$/, "");

  return `${withoutDb}/${dbName}${query ? `?${query}` : ""}`;

};

const connect = async () => {

  if (connected) {
    return mongoose.connection;
  }

  await mongoose.connect(uriFor(DB_NAME), {
    serverSelectionTimeoutMS: 15000,
  });

  connected = true;

  return mongoose.connection;

};

const clear = async () => {

  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }

};

const disconnect = async () => {

  if (!connected) {
    return;
  }

  // Drop rather than just disconnect: a stray test database on a
  // shared cluster is somebody's confusing afternoon later.
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();

  connected = false;

};

const isAvailable = () =>
  Boolean(process.env.TEST_MONGO_URI || process.env.MONGO_URI);

module.exports = { connect, clear, disconnect, isAvailable, DB_NAME };
