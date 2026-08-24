const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

// =======================================================
// APPROVAL ID COMES FROM THE URL
//
// The routes are PATCH /visitor-approvals/:approvalId/approve, but the
// service validates req.body. A client that trusted the URL alone got
// a validation error, and one that sent a different id in the body
// would have acted on a different request entirely.
//
// The service is stubbed out because what is under test is the
// controller's plumbing, not the approval rules.
// =======================================================

const SERVICE = require.resolve("../services/visitorApprovalService");
const CONTROLLER = require.resolve("../controllers/visitorApprovalController");

const loadControllerWithStub = () => {

  delete require.cache[CONTROLLER];

  const real = require.cache[SERVICE];

  const seen = {};

  const stub = {
    exports: {},
    id: SERVICE,
    filename: SERVICE,
    loaded: true,
    paths: [],
  };

  for (const name of ["approveRequest", "rejectRequest", "cancelRequest"]) {
    stub.exports[name] = async (body) => {
      seen[name] = body;
      return { ok: true };
    };
  }

  require.cache[SERVICE] = stub;

  try {
    return { controller: require(CONTROLLER), seen };
  } finally {
    if (real) {
      require.cache[SERVICE] = real;
    } else {
      delete require.cache[SERVICE];
    }
    delete require.cache[CONTROLLER];
  }

};

const fakeRes = () => {
  const res = {};
  res.status = () => res;
  res.json = () => res;
  return res;
};

const ID_IN_URL = "a".repeat(24);
const ID_IN_BODY = "b".repeat(24);

test("the approval id is taken from the URL, not the body", async () => {

  const { controller, seen } = loadControllerWithStub();

  const cases = [
    ["approveRequest", {}],
    ["rejectRequest", { rejectionReason: "Not expecting anyone" }],
    ["cancelRequest", {}],
  ];

  for (const [name, body] of cases) {

    await controller[name](
      {
        params: { approvalId: ID_IN_URL },
        // A client that names one approval in the path and another in
        // the payload must not be able to act on the second.
        body: { ...body, approvalId: ID_IN_BODY },
        user: { id: "resident", societyId: "society" },
      },
      fakeRes(),
      () => {}
    );

    assert.equal(
      seen[name].approvalId,
      ID_IN_URL,
      `${name} must act on the approval named in its route`
    );

  }

  assert.equal(
    seen.rejectRequest.rejectionReason,
    "Not expecting anyone",
    "the rest of the body must still reach the service"
  );

});

test("a client that sends no body still addresses the right approval", async () => {

  const { controller, seen } = loadControllerWithStub();

  await controller.approveRequest(
    {
      params: { approvalId: ID_IN_URL },
      body: undefined,
      user: { id: "resident", societyId: "society" },
    },
    fakeRes(),
    () => {}
  );

  assert.equal(seen.approveRequest.approvalId, ID_IN_URL);

});

test("the routes really do name the approval in the path", () => {

  const fs = require("node:fs");

  const source = fs.readFileSync(
    path.join(__dirname, "..", "routes", "visitorApprovalRoutes.js"),
    "utf8"
  );

  for (const action of ["approve", "reject", "cancel"]) {
    assert.match(
      source,
      new RegExp(`/:approvalId/${action}`),
      `the ${action} route is expected to carry :approvalId`
    );
  }

});
