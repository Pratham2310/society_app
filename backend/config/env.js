// =======================================================
// ENVIRONMENT CONTRACT
// Validates required configuration at startup so a missing
// variable fails loudly on boot instead of surfacing as a
// confusing runtime error on the first request that needs it.
// =======================================================

const REQUIRED = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_NAME",
  "CLOUDINARY_KEY",
  "CLOUDINARY_SECRET",
];

const loadEnv = () => {

  const missing = REQUIRED.filter(
    (key) => !process.env[key] || !process.env[key].trim()
  );

  if (missing.length) {

    console.error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `See AI_CONTEXT/ENVIRONMENT.md for the full contract.`
    );

    process.exit(1);

  }

  if (process.env.JWT_SECRET.length < 32) {

    console.error(
      "JWT_SECRET must be at least 32 characters."
    );

    process.exit(1);

  }

  return {

    nodeEnv: process.env.NODE_ENV || "development",

    port: process.env.PORT || 5000,

    mongoUri: process.env.MONGO_URI,

    jwtSecret: process.env.JWT_SECRET,

    corsOrigins: (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),

  };

};

module.exports = { loadEnv, REQUIRED };
