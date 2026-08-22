// =======================================================
// OPENAPI GENERATOR
//
// Derives the spec from the real route table rather than a
// hand-maintained document, because a spec that is written
// separately from the routes drifts from them within a week.
//
//   npm run openapi          write backend/openapi.json
//   npm run openapi -- --check   fail if it is out of date (CI)
//
// All three clients generate their types from the output.
// =======================================================

const fs = require("node:fs");
const path = require("node:path");

const ROUTES_DIR = path.join(__dirname, "..", "routes");
const OUTPUT = path.join(__dirname, "..", "openapi.json");

const API_VERSION = "v1";

// ---- read the mount table -----------------------------------------

const readMounts = () => {

  const source = fs.readFileSync(path.join(ROUTES_DIR, "index.js"), "utf8");

  const mounts = [];

  const pattern = /\["([^"]+)",\s*require\("\.\/(\w+)"\)\]/g;

  let match;
  while ((match = pattern.exec(source)) !== null) {
    mounts.push({ prefix: match[1], module: match[2] });
  }

  return mounts;

};

// ---- parse one router file ----------------------------------------

const ROUTE_PATTERN =
  /router\.(get|post|put|patch|delete)\(\s*("(?:[^"]*)"|'(?:[^']*)')([^;]*?)\)\s*;/gs;

const parseRouter = (moduleName) => {

  const raw = fs.readFileSync(
    path.join(ROUTES_DIR, `${moduleName}.js`),
    "utf8"
  );

  // Commented-out routes are not part of the API. userRoutes.js keeps a
  // disabled duplicate of /pending-users with no auth on it, which
  // otherwise shows up in the spec as a public endpoint leaking users.
  const source = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Auth applied to the whole router.
  // Match the auth middleware exactly. A loose /auth\w*/ also matches
  // authLimiter, which marked the public login route as authenticated.
  const routerLevelAuth =
    /router\.use\(\s*(auth|authMiddleware)\s*\)/.test(source);
  const routerLevelApproved = /router\.use\(\s*checkApproved\s*\)/.test(source);

  const operations = [];

  let match;
  ROUTE_PATTERN.lastIndex = 0;

  while ((match = ROUTE_PATTERN.exec(source)) !== null) {

    const method = match[1];
    const routePath = match[2].slice(1, -1);
    const rest = match[3] || "";

    const roles = [];
    const rolePattern = /require(?:System|Society)Role\(([^)]*)\)/g;
    let roleMatch;
    while ((roleMatch = rolePattern.exec(rest)) !== null) {
      for (const raw of roleMatch[1].split(",")) {
        const value = raw.trim().replace(/^["']|["']$/g, "");
        if (value) roles.push(value);
      }
    }

    operations.push({
      method,
      path: routePath,
      requiresAuth:
        routerLevelAuth || /(?:^|[(,\s])(auth|authMiddleware)\s*,/.test(rest),
      requiresApproval: routerLevelApproved || /checkApproved/.test(rest),
      roles: [...new Set(roles)],
      handler: (rest.match(/(\w+)\.(\w+)\s*\)?\s*$/) || [])[2] || null,
    });

  }

  return operations;

};

// ---- OpenAPI assembly ---------------------------------------------

const toOpenApiPath = (full) =>
  full.replace(/:(\w+)/g, "{$1}").replace(/\/+$/, "") || "/";

const pathParams = (full) =>
  [...full.matchAll(/:(\w+)/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "MongoDB ObjectId",
  }));

const PAGINATION_PARAMS = [
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    description: "Page size. Values above 100 are clamped.",
  },
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "Offset pagination — used by the web consoles.",
  },
  {
    name: "mode",
    in: "query",
    schema: { type: "string", enum: ["cursor"] },
    description:
      "Set to `cursor` to open a cursor sequence. Used by the Expo app, whose lists scroll infinitely.",
  },
  {
    name: "cursor",
    in: "query",
    schema: { type: "string" },
    description: "The `meta.nextCursor` from the previous page.",
  },
];

const isCollection = (op) => {
  if (op.method !== "get") return false;
  const last = op.path.replace(/\/+$/, "").split("/").pop() || "";
  if (last.startsWith(":")) return false;
  return !/statistic/i.test(op.path);
};

const build = () => {

  const mounts = readMounts();

  const paths = {};

  let count = 0;

  for (const mount of mounts) {

    const tag = mount.prefix.replace(/^\//, "").split("/")[0];

    for (const op of parseRouter(mount.module)) {

      const full = `${mount.prefix}${op.path === "/" ? "" : op.path}` || "/";
      const key = `/api/${API_VERSION}${toOpenApiPath(full)}`;

      paths[key] = paths[key] || {};

      const parameters = [...pathParams(full)];

      if (isCollection(op)) {
        parameters.push(...PAGINATION_PARAMS);
      }

      const responses = {
        200: {
          description: "Success",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Envelope" },
            },
          },
        },
      };

      if (op.requiresAuth) {
        responses[401] = { $ref: "#/components/responses/Unauthorized" };
      }

      if (op.roles.length || op.requiresApproval) {
        responses[403] = { $ref: "#/components/responses/Forbidden" };
      }

      responses[404] = { $ref: "#/components/responses/NotFound" };

      const description = [
        op.requiresApproval ? "Caller must be an approved member." : null,
        op.roles.length ? `Roles: ${op.roles.join(", ")}.` : null,
        isCollection(op)
          ? "Paginated. Responses carry a `meta` object."
          : null,
      ]
        .filter(Boolean)
        .join(" ");

      paths[key][op.method] = {
        tags: [tag],
        summary: op.handler || `${op.method.toUpperCase()} ${full}`,
        ...(description ? { description } : {}),
        ...(parameters.length ? { parameters } : {}),
        ...(op.requiresAuth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
        responses,
      };

      count += 1;

    }

  }

  const errorResponse = (description) => ({
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "Society App API",
      version: "1.0.0",
      description:
        "Backend for a multi-tenant society management platform.\n\n" +
        "Three clients consume this API: an Expo app for residents and " +
        "security guards, a society admin console, and a platform console " +
        "for superadmin and salesperson.\n\n" +
        "Every response uses the same envelope. Every society-scoped record " +
        "is constrained to the caller's society; only superadmin and " +
        "salesperson read across societies.\n\n" +
        "This document is generated from the route table — edit the routes, " +
        "not this file.",
    },
    servers: [
      { url: "http://localhost:5000", description: "Local" },
      { url: "https://{host}", description: "Deployed", variables: { host: { default: "example.onrender.com" } } },
    ],
    tags: [...new Set(Object.values(paths).flatMap((p) => Object.values(p).flatMap((o) => o.tags)))]
      .sort()
      .map((name) => ({ name })),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Access tokens last 8h for superadmin and salesperson, 30d for residents.",
        },
      },
      schemas: {
        Envelope: {
          type: "object",
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {},
            meta: { $ref: "#/components/schemas/PaginationMeta" },
          },
        },
        Error: {
          type: "object",
          required: ["success", "message", "data"],
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
            data: { type: "null" },
          },
        },
        PaginationMeta: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            hasMore: { type: "boolean" },
            page: { type: "integer", description: "Offset mode only." },
            total: { type: "integer", description: "Offset mode only." },
            totalPages: { type: "integer", description: "Offset mode only." },
            nextCursor: {
              type: ["string", "null"],
              description: "Cursor mode only. Pass as `?cursor=` for the next page.",
            },
            truncated: {
              type: "boolean",
              description:
                "The response exceeded the hard cap and was trimmed. Page through the full set.",
            },
          },
        },
      },
      responses: {
        Unauthorized: errorResponse("Missing, malformed or expired token."),
        Forbidden: errorResponse("Authenticated but not permitted, or not yet approved."),
        NotFound: errorResponse(
          "No such record. Also returned when a record belongs to another society."
        ),
      },
    },
    paths,
    "x-operation-count": count,
  };

};

// ---- entrypoint ----------------------------------------------------

const spec = build();
const serialised = `${JSON.stringify(spec, null, 2)}\n`;

if (process.argv.includes("--check")) {

  const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";

  if (current !== serialised) {
    console.error(
      "\n  openapi.json is out of date. Run `npm run openapi` and commit the result.\n"
    );
    process.exit(1);
  }

  console.log(`  openapi.json is current (${spec["x-operation-count"]} operations)`);

} else {

  fs.writeFileSync(OUTPUT, serialised);
  console.log(
    `  wrote ${path.relative(process.cwd(), OUTPUT)} — ` +
    `${spec["x-operation-count"]} operations across ${Object.keys(spec.paths).length} paths`
  );

}
