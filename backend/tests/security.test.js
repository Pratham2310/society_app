const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

const app = require("../app");

const BACKEND = path.join(__dirname, "..");

const read = (relative) =>
  fs.readFileSync(path.join(BACKEND, relative), "utf8");

const withServer = async (fn) => {

  const server = app.listen(0);

  await new Promise((resolve) => server.once("listening", resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

};


test("no route can create a superadmin", () => {

  const routeFiles = fs.readdirSync(path.join(BACKEND, "routes"));

  for (const file of routeFiles) {

    const source = read(path.join("routes", file));

    assert.ok(
      !/router\.(post|put|patch)\([^)]*create-superadmin/i.test(source),
      `${file} exposes superadmin creation over HTTP`
    );

  }

});


test("public registration cannot set a privileged role", () => {

  const service = read("services/authService.js");

  // The role written on registration must be the literal "user",
  // never a value taken from the request body.
  assert.ok(
    /systemRole:\s*"user"/.test(service),
    "registerUser must hard-code systemRole to \"user\""
  );

  assert.ok(
    !/systemRole:\s*systemRole/.test(service),
    "registerUser must not take systemRole from the caller"
  );

  const validation = read("validation/authValidation.js");

  assert.ok(
    !/role\s*:\s*Joi/.test(validation),
    "registerSchema must not accept a role field"
  );

});


test("secrets and OTPs are never logged", () => {

  const offenders = [];

  const walk = (dir) => {

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "tests" || entry.name === "node_modules") continue;
        walk(full);
        continue;
      }

      if (!entry.name.endsWith(".js")) continue;

      const source = fs.readFileSync(full, "utf8");

      const dangerous = [
        /console\.\w+\([^)]*MONGO_URI/,
        /console\.\w+\([^)]*JWT_SECRET/,
        /console\.\w+\([^)]*\botp\b/i,
        /console\.\w+\([^)]*decoded/,
        /console\.\w+\([^)]*req\.user/,
        /console\.\w+\([^)]*password/i,
      ];

      for (const pattern of dangerous) {

        // Ignore commented-out lines.
        const hit = source
          .split("\n")
          .find((line) => pattern.test(line) && !line.trim().startsWith("//"));

        if (hit) {
          offenders.push(`${path.relative(BACKEND, full)}: ${hit.trim()}`);
        }

      }

    }

  };

  walk(BACKEND);

  assert.deepStrictEqual(
    offenders,
    [],
    `secret-bearing log statements found:\n${offenders.join("\n")}`
  );

});


test("password is never selected by default", () => {

  const model = read("models/User.js");

  assert.ok(
    /password:\s*\{[^}]*select:\s*false/s.test(model),
    "User.password must be select:false"
  );

});


test("OTP is stored hashed, not in plain text", () => {

  const model = read("models/User.js");
  const service = read("services/otpServices.js");

  assert.ok(
    !/^\s*otp:\s*String/m.test(model),
    "User must not store a plain-text otp field"
  );

  assert.ok(
    /otpHash/.test(model) && /bcrypt\.hash/.test(service),
    "OTP must be hashed before storage"
  );

});


test("the upload route is authenticated and capped", () => {

  const route = read("routes/uploadRoutes.js");
  const middleware = read("middleware/upload.js");

  assert.ok(/auth/.test(route), "upload route must require authentication");
  assert.ok(/Limiter/.test(route), "upload route must be rate limited");
  assert.ok(/fileSize/.test(middleware), "upload must cap file size");
  assert.ok(/fileFilter/.test(middleware), "upload must validate MIME types");
  assert.ok(
    /societyId/.test(middleware),
    "uploads must be scoped to the caller's society"
  );

});


test("rate limiting is enabled, not commented out", () => {

  const source = read("middleware/rateLimitMiddleware.js");

  assert.ok(
    /^\s*const rateLimit = require/m.test(source),
    "rate limit middleware must not be commented out"
  );

  assert.ok(
    /exports\.(otpLimiter|authLimiter)/.test(source),
    "rate limiters must be exported"
  );

});


test("health and readiness endpoints respond", async () => {

  await withServer(async (base) => {

    const health = await fetch(`${base}/health`);
    assert.strictEqual(health.status, 200);

    const healthBody = await health.json();
    assert.strictEqual(healthBody.status, "ok");

    // Not connected to Mongo in tests, so readiness must refuse traffic.
    const ready = await fetch(`${base}/ready`);
    assert.strictEqual(
      ready.status,
      503,
      "/ready must fail when the database is disconnected"
    );

  });

});


test("security headers are present", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/health`);

    assert.ok(
      res.headers.get("x-content-type-options"),
      "helmet should set x-content-type-options"
    );

  });

});


test("a browser origin outside the allowlist is rejected", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/health`, {
      headers: { Origin: "https://not-allowed.example.com" },
    });

    assert.ok(
      !res.headers.get("access-control-allow-origin"),
      "disallowed origins must not receive an allow-origin header"
    );

  });

});
