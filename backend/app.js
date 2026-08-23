//Must run before any model is compiled, so every society-owned
//schema picks up the tenant scope. Keep this the first import.
require("./models/plugins/register");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const app = express();

const { globalLimiter } = require("./middleware/rateLimitMiddleware");

const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const responseEnvelope = require("./middleware/responseEnvelope");
const { buildApiRouter } = require("./routes");
const AppError = require("./utils/appError");

const API_VERSION = "v1";

//Render sits behind a proxy; without this the rate limiter and any
//IP-derived value see the proxy address instead of the client.
app.set("trust proxy", 1);

//Request logging first, so even a rejected request is recorded and
//carries an id the client can quote.
app.use(requestLogger);

app.use(helmet());

//Cap request bodies. The default is 100kb but making it explicit
//keeps a malformed client from becoming a memory problem.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

//CORS is only meaningful for the two web consoles — a native Expo
//client does not enforce it. An empty allowlist blocks browsers
//entirely, which is the correct default for an API with no web
//origin configured yet.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requests with no Origin header (mobile apps, curl, server-to-server)
    // are not browser cross-origin requests and are not CORS's business.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // AppError, not a bare Error: a plain Error carries no status, so
    // the handler defaulted to 500 and every blocked browser request
    // was logged as a server fault and reported to Sentry as a defect.
    // A disallowed origin is the policy working, not a failure.
    return callback(
      new AppError(`Origin ${origin} is not allowed by CORS`, 403)
    );
  },
  credentials: true,
}));

app.use(globalLimiter);


//=====================================================================
//Health and readiness
//=====================================================================

//Liveness: is the process up? Must not touch the database, or a brief
//Mongo blip would make the platform kill a healthy container.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

//Readiness: should this instance receive traffic?
app.get("/ready", (req, res) => {

  const state = mongoose.connection.readyState;

  if (state === 1) {
    return res.status(200).json({ status: "ready", database: "connected" });
  }

  return res.status(503).json({ status: "not-ready", database: "disconnected" });

});

// Routes
//Every response goes through one envelope. Must sit above the
//routers so it wraps their res.json.
app.use(responseEnvelope);

//Client version gate. An installed Expo build cannot be upgraded on
//demand, so the app asks on launch whether it is still supported.
//This is the only lever that makes a future breaking change possible.
app.get(`/api/${API_VERSION}/client-version`, (req, res) => {

  res.json({
    //Below this, the app must block and send the user to the store.
    minimumSupported: process.env.MIN_CLIENT_VERSION || "1.0.0",
    //Below this, prompt but allow continuing.
    latest: process.env.LATEST_CLIENT_VERSION || "1.0.0",
    apiVersion: API_VERSION,
  });

});

//The generated contract, served so all three clients can pull it.
//Sent with res.send, not res.json: an OpenAPI document is not an API
//response and must not be wrapped in the envelope, or every code
//generator and viewer rejects it.
app.get(`/api/${API_VERSION}/openapi.json`, (req, res) => {

  try {

    res
      .type("application/json")
      .send(JSON.stringify(require("./openapi.json")));

  } catch {

    res.status(503).json({ message: "Spec not generated. Run npm run openapi." });

  }

});

//Versioned mount. An installed Expo build cannot be upgraded on
//demand, so its contract has to stay reachable at a stable path
//while the web consoles move on.
app.use(`/api/${API_VERSION}`, buildApiRouter());

//Unversioned alias, kept so nothing breaks mid-migration. Callers
//get a Deprecation header telling them where to go; remove this
//mount once the clients are on /api/v1.
app.use("/api", (req, res, next) => {
  res.set("Deprecation", "true");
  res.set("Link", `</api/${API_VERSION}>; rel="successor-version"`);
  next();
}, buildApiRouter());

// Home Route
app.get("/", (req, res) => {
  res.send("Welcome to society app backend");
});

// 404 Handler
app.use((req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server!`,
      404
    )
  );
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;