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

const { getPagination, applyPagination, buildPage, MAX_LIMIT } =
  require("../utils/pagination");

const BACKEND = path.join(__dirname, "..");

const withServer = async (fn) => {
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
};


// =======================================================
// VERSIONING
// =======================================================

test("the API is served under a version prefix", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/api/v1/notices`);

    // 401 (not 404) proves the route exists behind auth.
    assert.strictEqual(res.status, 401, "/api/v1 must be mounted");

  });

});


test("the unversioned path still works but announces deprecation", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/api/notices`);

    assert.strictEqual(res.status, 401, "/api must stay reachable during migration");

    assert.strictEqual(
      res.headers.get("deprecation"),
      "true",
      "the unversioned alias must send a Deprecation header"
    );

    assert.match(
      res.headers.get("link") || "",
      /successor-version/,
      "clients must be told where the versioned API lives"
    );

  });

});


// =======================================================
// RESPONSE ENVELOPE
// =======================================================

test("every response uses one envelope", async () => {

  await withServer(async (base) => {

    const cases = [
      `${base}/api/v1/notices`,
      `${base}/api/v1/definitely-not-a-route`,
      `${base}/api/v1/auth/login`,
    ];

    for (const url of cases) {

      const res = await fetch(url, { method: "GET" });
      const body = await res.json();

      assert.ok("success" in body, `${url} must return success`);
      assert.ok("message" in body, `${url} must return message`);
      assert.ok("data" in body, `${url} must return data`);

      assert.strictEqual(
        typeof body.success,
        "boolean",
        `${url}: success must be a boolean`
      );

      assert.strictEqual(
        body.success,
        res.status < 400,
        `${url}: success must agree with the status code`
      );

    }

  });

});


test("the envelope survives the shape typos in the controllers", () => {

  const source = fs.readFileSync(
    path.join(BACKEND, "middleware", "responseEnvelope.js"),
    "utf8"
  );

  // Two controllers shipped {succes:true} and {messsage:...}.
  assert.match(source, /succes"/, "the typo'd success key must be normalised");
  assert.match(source, /messsage"/, "the typo'd message key must be normalised");

});


// =======================================================
// ERROR STATUS CODES
// =======================================================

test("no controller hardcodes a 500 in a catch block", () => {

  const dir = path.join(BACKEND, "controllers");

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {

    const source = fs.readFileSync(path.join(dir, file), "utf8");

    assert.ok(
      !/res\.status\(500\)/.test(source),
      `${file} still hardcodes 500 — an AppError's status would be lost`
    );

  }

});


// =======================================================
// PAGINATION
// =======================================================

test("limit is clamped so no caller can request everything", () => {

  assert.strictEqual(getPagination({ limit: "5000" }).limit, MAX_LIMIT);
  assert.strictEqual(getPagination({ limit: "-4" }).limit, 20);
  assert.strictEqual(getPagination({ limit: "abc" }).limit, 20);
  assert.strictEqual(getPagination({}).limit, 20);

});


test("offset mode serves the web console", () => {

  const p = getPagination({ page: "3", limit: "10" });

  assert.strictEqual(p.mode, "offset");
  assert.strictEqual(p.page, 3);
  assert.strictEqual(p.skip, 20);

});


test("a client can start a cursor sequence without holding a cursor", () => {

  // The bug this guards: cursor mode only activating once a cursor
  // exists means a mobile client can never obtain the first one.
  const first = getPagination({ mode: "cursor", limit: "10" });

  assert.strictEqual(first.mode, "cursor");
  assert.strictEqual(first.cursor, null);

});


test("a valid cursor selects cursor mode on its own", () => {

  const p = getPagination({ cursor: "6a89abfe7a0f4730dfddcd78" });

  assert.strictEqual(p.mode, "cursor");
  assert.strictEqual(p.cursor, "6a89abfe7a0f4730dfddcd78");

});


test("a malformed cursor falls back rather than throwing", () => {

  const p = getPagination({ cursor: "not-an-object-id" });

  assert.strictEqual(p.mode, "offset");
  assert.strictEqual(p.cursor, null);

});


test("page building reports hasMore without a second count query", () => {

  const pagination = getPagination({ mode: "cursor", limit: "2" });

  // Repositories fetch limit+1; the extra row is the hasMore signal.
  const rows = [{ _id: "a" }, { _id: "b" }, { _id: "c" }];

  const page = buildPage(rows, pagination);

  assert.strictEqual(page.items.length, 2, "the probe row must be trimmed off");
  assert.strictEqual(page.meta.hasMore, true);
  assert.strictEqual(page.meta.nextCursor, "b");

});


test("the last page reports hasMore false and no next cursor", () => {

  const pagination = getPagination({ mode: "cursor", limit: "5" });

  const page = buildPage([{ _id: "a" }, { _id: "b" }], pagination);

  assert.strictEqual(page.items.length, 2);
  assert.strictEqual(page.meta.hasMore, false);
  assert.strictEqual(page.meta.nextCursor, null);

});


test("offset pages report totals for table UIs", () => {

  const pagination = getPagination({ page: "1", limit: "10" });

  const rows = Array.from({ length: 11 }, (_, i) => ({ _id: String(i) }));

  const page = buildPage(rows, pagination, 25);

  assert.strictEqual(page.meta.total, 25);
  assert.strictEqual(page.meta.totalPages, 3);
  assert.strictEqual(page.meta.page, 1);

});


test("cursor paging asks for one more row than the page size", () => {

  const calls = { where: null, sort: null, limit: null };

  const fakeQuery = {
    where(clause) { calls.where = clause; return this; },
    sort(spec) { calls.sort = spec; return this; },
    limit(n) { calls.limit = n; return this; },
  };

  applyPagination(fakeQuery, getPagination({ cursor: "6a89abfe7a0f4730dfddcd78", limit: "10" }));

  assert.deepStrictEqual(calls.sort, { _id: -1 });
  assert.strictEqual(calls.limit, 11);
  assert.ok(calls.where._id.$lt, "cursor paging must filter past the cursor");

});


test("responses cannot carry an unbounded collection", () => {

  const source = fs.readFileSync(
    path.join(BACKEND, "middleware", "responseEnvelope.js"),
    "utf8"
  );

  assert.match(
    source,
    /capCollection/,
    "the envelope must cap array payloads as a wire-level backstop"
  );

  assert.match(
    source,
    /truncated/,
    "a capped response must say so rather than silently dropping rows"
  );

});


test("complaint listing actually returns rows", () => {

  // findAll had no return statement, so listing resolved to undefined.
  const source = fs.readFileSync(
    path.join(BACKEND, "repository", "complaintRepository.js"),
    "utf8"
  );

  assert.match(
    source,
    /return applyPagination\(/,
    "complaintRepository must return its query"
  );

});


// =======================================================
// GENERATED CONTRACT
// =======================================================

test("the OpenAPI spec is served", async () => {

  await withServer(async (base) => {

    const res = await fetch(`${base}/api/v1/openapi.json`);

    assert.strictEqual(res.status, 200);

    const spec = await res.json();

    assert.strictEqual(spec.openapi, "3.1.0");
    assert.ok(spec.paths["/api/v1/notices"], "the spec must describe real routes");

  });

});


test("the spec is generated, not hand-maintained", () => {

  const spec = require("../openapi.json");

  // A spec written by hand drifts from the routes within a week.
  assert.match(
    spec.info.description,
    /generated from the route table/,
    "the spec must declare its provenance"
  );

  assert.ok(
    spec["x-operation-count"] > 100,
    "the spec should cover the whole surface"
  );

});


test("the spec does not describe commented-out routes", () => {

  const spec = require("../openapi.json");

  // userRoutes.js keeps a disabled duplicate of /pending-users with no
  // auth on it. Parsing comments listed it as a public endpoint.
  const pendingUsers = spec.paths["/api/v1/users/pending-users"];

  assert.ok(pendingUsers?.get, "the real route should be present");

  assert.ok(
    (pendingUsers.get.security || []).length > 0,
    "/users/pending-users must require authentication"
  );

});


test("the public surface is exactly the auth and signup flows", () => {

  const spec = require("../openapi.json");

  const publicOps = Object.entries(spec.paths)
    .flatMap(([routePath, methods]) =>
      Object.entries(methods)
        .filter(([, op]) => !(op.security || []).length)
        .map(([method]) => `${method.toUpperCase()} ${routePath}`)
    )
    .sort();

  // Locking this list means a new unauthenticated endpoint fails the
  // build rather than shipping quietly.
  // Sorted, so GET precedes POST.
  assert.deepStrictEqual(publicOps, [
    // Wings, floors and flats for the "Where do you live?" step. The
    // resident has no token yet — register-full is what creates the
    // account. Gated by the society code, and exposes only a building
    // layout with occupancy: no names, contacts or ownership.
    "GET /api/v1/societies/{societyId}/structure",

    // Password reset has to be reachable by someone who cannot sign
    // in — that is the whole point of it. Neither endpoint reveals
    // whether an account exists, and both are throttled: forgot by the
    // OTP limiter, reset by the auth one.
    "POST /api/v1/auth/forgot-password",

    "POST /api/v1/auth/login",
    "POST /api/v1/auth/register",
    "POST /api/v1/auth/reset-password",
    "POST /api/v1/auth/send-otp",
    "POST /api/v1/auth/verify-otp",
    "POST /api/v1/societies/verify-code",
    "POST /api/v1/users/register-full",
  ]);

});


test("collection endpoints document their pagination", () => {

  const spec = require("../openapi.json");

  const listEndpoint = spec.paths["/api/v1/notices"].get;

  const names = (listEndpoint.parameters || []).map((p) => p.name);

  for (const expected of ["limit", "page", "mode", "cursor"]) {
    assert.ok(
      names.includes(expected),
      `a paginated endpoint must document ?${expected}`
    );
  }

});
