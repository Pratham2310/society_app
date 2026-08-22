const test = require("node:test");
const assert = require("node:assert");

// The app must load without a database connection. Anything that
// needs Mongo belongs in an integration test, not here.
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

const app = require("../app");

const fs = require("node:fs");
const path = require("node:path");

const ROUTES_DIR = path.join(__dirname, "..", "routes");

// Modules that are deliberately commented out and not mounted.
// Keep this list empty-able: if a feature is revived, drop it from here.
const DISABLED = new Set(["inviteRoutes.js"]);

//index.js is the mount table, not a route module.
const NOT_A_ROUTE_MODULE = new Set(["index.js"]);

const routeFiles = fs.readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".js"))
  .filter((f) => !DISABLED.has(f))
  .filter((f) => !NOT_A_ROUTE_MODULE.has(f));

// Every route layer a router registered, as { method, path }.
const routesOf = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods || {})
        .map((method) => ({ method, path: layer.route.path }))
    );


// =======================================================
// A listening instance on an ephemeral port.
// =======================================================

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


test("app module loads", () => {
  assert.ok(app, "app should be defined");
  assert.strictEqual(typeof app.listen, "function");
});


test("disabled route modules are not mounted", () => {

  const appSource = fs.readFileSync(
    path.join(__dirname, "..", "app.js"),
    "utf8"
  );

  for (const file of DISABLED) {

    const name = file.replace(/\.js$/, "");

    assert.ok(
      !appSource.includes(`routes/${name}"`) &&
      !appSource.includes(`routes/${name}'`),
      `${file} is disabled but app.js still requires it`
    );

  }

});


test("the mount table covers every route module", () => {

  const { MOUNTS } = require("../routes");

  const mounted = MOUNTS.length;

  assert.strictEqual(
    mounted,
    routeFiles.length,
    `routes/ has ${routeFiles.length} route modules but the table mounts ${mounted}`
  );

  const paths = MOUNTS.map(([p]) => p);

  assert.strictEqual(
    new Set(paths).size,
    paths.length,
    "two routers are mounted on the same path"
  );

  for (const [p] of MOUNTS) {
    assert.ok(p.startsWith("/"), `mount path "${p}" must start with a slash`);
  }

});


test("every route file exports a usable router", () => {

  assert.ok(routeFiles.length >= 20, "expected the full set of route modules");

  for (const file of routeFiles) {

    const router = require(path.join(ROUTES_DIR, file));

    assert.strictEqual(
      typeof router,
      "function",
      `${file} must export an Express router`
    );

    assert.ok(
      Array.isArray(router.stack),
      `${file} must export an Express router, got something else`
    );

  }

});


test("no route path is missing its leading slash", () => {

  for (const file of routeFiles) {

    const router = require(path.join(ROUTES_DIR, file));

    for (const { method, path: routePath } of routesOf(router)) {

      assert.ok(
        routePath.startsWith("/"),
        `${file}: ${method.toUpperCase()} "${routePath}" must start with a slash`
      );

    }

  }

});


test("no literal route is shadowed by an earlier parameterised route", () => {

  for (const file of routeFiles) {

    const router = require(path.join(ROUTES_DIR, file));

    const routes = routesOf(router);

    for (let i = 0; i < routes.length; i++) {

      for (let j = i + 1; j < routes.length; j++) {

        if (routes[i].method !== routes[j].method) continue;

        const earlier = routes[i].path.split("/");
        const later = routes[j].path.split("/");

        if (earlier.length !== later.length) continue;

        let shadows = false;

        for (let k = 0; k < earlier.length; k++) {

          const a = earlier[k];
          const b = later[k];

          if (a === b) continue;

          if (a.startsWith(":") && !b.startsWith(":")) {
            shadows = true;
            continue;
          }

          shadows = false;
          break;

        }

        assert.ok(
          !shadows,
          `${file}: ${routes[j].method.toUpperCase()} "${routes[j].path}" is unreachable — ` +
          `"${routes[i].path}" is registered earlier and swallows it`
        );

      }

    }

  }

});


test("root route responds", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/`);

    assert.strictEqual(res.status, 200);

  });

});


test("unknown route returns a 404 envelope", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/api/definitely-not-a-route`);

    assert.strictEqual(res.status, 404);

    const body = await res.json();

    assert.strictEqual(body.success, false);

  });

});


test("protected gate routes reject anonymous callers", async () => {

  await withServer(async (base) => {

    const guarded = [
      "/api/guest-passes/statistics",
      "/api/gate-log/today",
      "/api/visitor-approvals/statistics",
    ];

    for (const path of guarded) {

      const res = await fetch(`${base}${path}`);

      assert.strictEqual(
        res.status,
        401,
        `${path} should require authentication`
      );

    }

  });

});


test("controllers export every handler their routes reference", () => {

  // Guards against the class of bug where a route names a handler
  // that does not exist, which Express only surfaces at call time.
  const pairs = [
    ["../controllers/guestPassController", [
      "createGuestPass", "getGuestPassById", "getResidentGuestPasses",
      "getGuestPassesBySociety", "approveGuestPass", "cancelGuestPass",
      "extendGuestPass", "archiveGuestPass", "regenerateGuestPassQRCode",
      "getGuestPassStatistics",
    ]],
    ["../controllers/gateLogController", [
      "scanVisitorEntry", "scanVisitorExit", "getGateLogs",
      "getGuestVisitHistory", "getTodayGateLogs", "getGateLogStatistics",
    ]],
    ["../controllers/visitorApprovalController", [
      "requestApproval", "approveRequest", "rejectRequest", "cancelRequest",
      "getApprovalById", "getResidentPendingRequests",
      "getGuardPendingRequests", "getApprovalStatistics",
    ]],
  ];

  for (const [modulePath, handlers] of pairs) {

    const mod = require(modulePath);

    for (const handler of handlers) {

      assert.strictEqual(
        typeof mod[handler],
        "function",
        `${modulePath} must export ${handler}`
      );

    }

  }

});
