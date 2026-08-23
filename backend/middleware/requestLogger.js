const crypto = require("node:crypto");
const pinoHttp = require("pino-http");

const logger = require("../utils/logger");

// =======================================================
// REQUEST LOGGING
//
// Every request gets an id, echoed back as X-Request-Id. When a
// resident reports a problem, that id is the thread that ties the
// Expo crash, the backend log line and the Sentry event together.
// =======================================================

module.exports = pinoHttp({

  logger,

  genReqId: (req, res) => {

    // Honour an id the client already generated, so a mobile crash
    // report and the server log share one identifier.
    const existing = req.get("x-request-id");

    const id = existing && existing.length <= 100
      ? existing
      : crypto.randomUUID();

    res.setHeader("X-Request-Id", id);

    return id;

  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    // Health checks fire constantly and say nothing when they pass.
    const url = req.originalUrl || req.url;
    if (url === "/health" || url === "/ready") return "silent";
    return "info";
  },

  customSuccessMessage: (req, res) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,

  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${err.message}`,

  // Log who did it, never what they sent.
  customProps: (req) => ({
    userId: req.user?.id,
    societyId: req.user?.societyId,
    systemRole: req.user?.systemRole,
    societyRole: req.user?.societyRole,
  }),

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      //originalUrl, because a mounted router rewrites req.url to be
      //relative — every API request would otherwise log as "/".
      url: req.raw?.originalUrl || req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

});
