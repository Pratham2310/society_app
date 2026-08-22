const mongoose = require("mongoose");

// =======================================================
// START TRANSACTION
// Returns a session with an open transaction.
// =======================================================

exports.startTransaction = async () => {

  const session = await mongoose.startSession();

  session.startTransaction();

  return session;

};


// =======================================================
// COMMIT TRANSACTION
// =======================================================

exports.commitTransaction = async (session) => {

  if (!session) {

    return;

  }

  try {

    await session.commitTransaction();

  } finally {

    session.endSession();

  }

};


// =======================================================
// ABORT TRANSACTION
// Safe to call on an already-committed or ended session.
// =======================================================

exports.abortTransaction = async (session) => {

  if (!session) {

    return;

  }

  try {

    if (session.inTransaction()) {

      await session.abortTransaction();

    }

  } finally {

    session.endSession();

  }

};


// =======================================================
// WITH TRANSACTION
// Wraps a unit of work so callers cannot leak a session.
// =======================================================

exports.withTransaction = async (work) => {

  const session = await exports.startTransaction();

  try {

    const result = await work(session);

    await exports.commitTransaction(session);

    return result;

  } catch (error) {

    await exports.abortTransaction(session);

    throw error;

  }

};
