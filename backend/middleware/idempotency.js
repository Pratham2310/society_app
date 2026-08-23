const logger = require("../utils/logger");
const IdempotencyKey = require("../models/IdempotencyKey");
const AppError = require("../utils/appError");

// =======================================================
// IDEMPOTENCY
//
// Apply to any write a client might retry without knowing whether
// the first attempt landed — gate scans and payments especially.
//
// Flow:
//   no key            -> pass through (the header is optional)
//   unseen key        -> reserve it, run the handler, store the result
//   completed key     -> replay the stored response, do not re-run
//   in-progress key   -> 409, the first attempt is still running
//
// The unique index on { userId, key } is what makes the concurrent
// case safe: two simultaneous retries race to insert and exactly
// one wins.
// =======================================================

const HEADER = "idempotency-key";

module.exports = (req, res, next) => {

  const key = req.get(HEADER);

  if (!key) {
    return next();
  }

  if (typeof key !== "string" || key.length < 8 || key.length > 200) {
    return next(
      new AppError(
        "Idempotency-Key must be between 8 and 200 characters.",
        400
      )
    );
  }

  const endpoint = `${req.method} ${req.baseUrl}${req.path}`;

  const run = async () => {

    let record;

    try {

      record = await IdempotencyKey.create({
        key,
        userId: req.user.id,
        endpoint,
        status: "in_progress",
      });

    } catch (error) {

      if (error.code !== 11000) {
        throw error;
      }

      const existing = await IdempotencyKey.findOne({
        key,
        userId: req.user.id,
      }).lean();

      if (!existing) {
        throw error;
      }

      if (existing.endpoint !== endpoint) {
        throw new AppError(
          "This Idempotency-Key was already used for a different request.",
          422
        );
      }

      if (existing.status === "in_progress") {
        throw new AppError(
          "A request with this Idempotency-Key is still being processed.",
          409
        );
      }

      // Replay. The client gets byte-identical output to the original.
      res.set("Idempotent-Replay", "true");
      return res.status(existing.statusCode).json(existing.response);

    }

    // Capture whatever the handler ends up sending.
    const sendJson = res.json.bind(res);

    res.json = (payload) => {

      const result = sendJson(payload);

      // Only a success is worth replaying; a failed attempt should be
      // retryable with the same key.
      if (res.statusCode < 400) {

        IdempotencyKey.updateOne(
          { _id: record._id },
          {
            $set: {
              status: "completed",
              statusCode: res.statusCode,
              response: payload,
            },
          }
        ).catch((error) =>
          logger.error({ err: error }, "Failed to persist idempotent response")
        );

      } else {

        IdempotencyKey.deleteOne({ _id: record._id }).catch(() => {});

      }

      return result;

    };

    return next();

  };

  run().catch(next);

};

module.exports.HEADER = HEADER;
