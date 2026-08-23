const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const message = (text) => ({
  success: false,
  message: text,
});

// Mobile users sit behind carrier NAT, so many accounts share one IP.
// Keying auth limits on the identifier keeps one busy tower from
// locking out a whole neighbourhood.
const identifierKey = (req) =>
  req.body?.phone ||
  req.body?.identifier ||
  req.body?.email ||
  ipKeyGenerator(req);

// OTP requests: per phone number.
exports.otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: identifierKey,
  message: message("Too many OTP requests. Please try again in a minute."),
  standardHeaders: true,
  legacyHeaders: false,
});

// Login and register: per identifier, slower window.
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: identifierKey,
  message: message("Too many attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads: per authenticated user, falling back to IP.
exports.uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: message("Upload limit reached. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

// Everything else: a wide backstop against scraping.
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  message: message("Too many requests. Please slow down."),
  standardHeaders: true,
  legacyHeaders: false,
});
