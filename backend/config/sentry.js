const logger = require("../utils/logger");

// =======================================================
// ERROR TRACKING
//
// Optional by design: with no SENTRY_DSN set, every function here
// is a no-op and the app runs exactly as before. That keeps local
// development and CI from needing an account.
//
// The release is tagged so an Expo crash and the backend error it
// caused can be lined up against the same build.
// =======================================================

let Sentry = null;
let enabled = false;

const init = () => {

  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info("Sentry not configured — error tracking disabled");
    return false;
  }

  Sentry = require("@sentry/node");

  Sentry.init({

    dsn,

    environment: process.env.NODE_ENV || "development",

    release: process.env.RELEASE || undefined,

    // Traces cost money and this API is not latency-bound yet.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE || 0),

    // Sentry's defaults would attach request bodies and headers.
    // Those carry passwords, OTPs and bearer tokens.
    sendDefaultPii: false,

    beforeSend(event) {

      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }

      return event;

    },

  });

  enabled = true;

  logger.info({ release: process.env.RELEASE }, "Sentry initialised");

  return true;

};

// Report an error, attaching the identifiers that make it findable:
// the request id already in the logs, and who it happened to.
const captureException = (error, context = {}) => {

  if (!enabled || !Sentry) {
    return;
  }

  Sentry.withScope((scope) => {

    if (context.requestId) {
      scope.setTag("request_id", context.requestId);
    }

    if (context.userId) {
      scope.setUser({ id: String(context.userId) });
    }

    if (context.societyId) {
      scope.setTag("society_id", String(context.societyId));
    }

    if (context.route) {
      scope.setTag("route", context.route);
    }

    Sentry.captureException(error);

  });

};

const isEnabled = () => enabled;

const flush = async (timeout = 2000) => {

  if (!enabled || !Sentry) {
    return true;
  }

  return Sentry.flush(timeout);

};

module.exports = { init, captureException, isEnabled, flush };
