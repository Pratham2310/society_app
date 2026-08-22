const pino = require("pino");

// =======================================================
// STRUCTURED LOGGING
//
// Replaces console.log, which has no severity, no correlation,
// no redaction, and no shape a log platform can query.
//
// Redaction is the important part here. Earlier phases found
// MONGO_URI, decoded JWT payloads and OTP values being printed.
// Those paths are fixed, but a logger that cannot leak secrets is
// a stronger guarantee than remembering not to log them.
// =======================================================

const isProduction = process.env.NODE_ENV === "production";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['idempotency-key']",
  "res.headers['set-cookie']",
  "*.password",
  "*.newPassword",
  "*.currentPassword",
  "*.otp",
  "*.otpHash",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.jwt",
  "*.JWT_SECRET",
  "*.MONGO_URI",
  "*.CLOUDINARY_SECRET",
  "*.signature",
  "password",
  "otp",
  "token",
];

const logger = pino({

  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },

  // Render captures stdout, so pretty-printing in production only
  // makes the logs harder for the platform to parse.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }),

  base: {
    service: "society-app-api",
  },

  formatters: {
    level: (label) => ({ level: label }),
  },

});

module.exports = logger;
module.exports.REDACT_PATHS = REDACT_PATHS;
