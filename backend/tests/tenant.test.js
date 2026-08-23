const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_NAME = process.env.CLOUDINARY_NAME || "test";
process.env.CLOUDINARY_KEY = process.env.CLOUDINARY_KEY || "test";
process.env.CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || "test";

require("../app");

const mongoose = require("mongoose");
const { runWithTenant, runUnscoped } = require("../utils/tenantContext");

const SOCIETY_A = new mongoose.Types.ObjectId();
const SOCIETY_B = new mongoose.Types.ObjectId();

// Mongoose runs query middleware on exec(), not on construction, so
// invoke the registered pre-hooks the same way it does. This proves
// scoping without needing a live database.
const filterFor = (build) => {

  const query = build();

  const hooks = query.model.schema.s.hooks._pres.get(query.op) || [];

  for (const hook of hooks) {
    hook.fn.call(query, () => {});
  }

  return query.getFilter();

};


test("society-scoped models carry the scope plugin", () => {

  for (const name of ["GateLog", "GuestPass", "VisitorApproval", "Complaint"]) {

    const model = mongoose.model(name);

    assert.ok(
      model.schema.path("societyId"),
      `${name} should be society-owned`
    );

    assert.ok(
      (model.schema.s.hooks._pres.get("findOne") || []).length > 0,
      `${name} should have a pre-findOne scope hook`
    );

  }

});


test("findById is constrained to the caller's society", () => {

  const GateLog = mongoose.model("GateLog");
  const someId = new mongoose.Types.ObjectId();

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    const filter = filterFor(() => GateLog.findById(someId));

    assert.ok(
      filter.societyId,
      "findById must be scoped to a society"
    );

    assert.strictEqual(
      String(filter.societyId),
      String(SOCIETY_A),
      "findById must use the caller's societyId"
    );

  });

});


test("a Society A caller cannot construct a Society B query", () => {

  const GuestPass = mongoose.model("GuestPass");

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    // Even asking for everything comes back scoped.
    const filter = filterFor(() => GuestPass.find({}));

    assert.strictEqual(
      String(filter.societyId),
      String(SOCIETY_A)
    );

    assert.notStrictEqual(
      String(filter.societyId),
      String(SOCIETY_B),
      "Society A must never query Society B"
    );

  });

});


test("updates and deletes are scoped, not just reads", () => {

  const Complaint = mongoose.model("Complaint");
  const someId = new mongoose.Types.ObjectId();

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    const update = filterFor(() =>
      Complaint.findByIdAndUpdate(someId, { status: "resolved" })
    );

    assert.strictEqual(
      String(update.societyId),
      String(SOCIETY_A),
      "findByIdAndUpdate must be scoped"
    );

    const remove = filterFor(() => Complaint.findByIdAndDelete(someId));

    assert.strictEqual(
      String(remove.societyId),
      String(SOCIETY_A),
      "findByIdAndDelete must be scoped"
    );

  });

});


test("an explicit societyId filter is never widened", () => {

  const GateLog = mongoose.model("GateLog");

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    const filter = filterFor(() =>
      GateLog.find({ societyId: SOCIETY_B })
    );

    // The plugin must not silently rewrite a deliberate filter —
    // it constrains, it does not override.
    assert.strictEqual(
      String(filter.societyId),
      String(SOCIETY_B)
    );

  });

});


test("cross-tenant callers are not constrained", () => {

  const GuestPass = mongoose.model("GuestPass");

  runWithTenant({ societyId: null, crossTenant: true }, () => {

    const filter = filterFor(() => GuestPass.find({}));

    assert.strictEqual(
      filter.societyId,
      undefined,
      "superadmin and salesperson must be able to read across societies"
    );

  });

});


test("runUnscoped is an explicit, opt-in escape hatch", () => {

  const GuestPass = mongoose.model("GuestPass");

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    runUnscoped(() => {
      const filter = filterFor(() => GuestPass.find({}));
      assert.strictEqual(filter.societyId, undefined);
    });

    // and the surrounding scope is restored afterwards
    const filter = filterFor(() => GuestPass.find({}));
    assert.strictEqual(String(filter.societyId), String(SOCIETY_A));

  });

});


test("background scripts with no context are unaffected", () => {

  const GateLog = mongoose.model("GateLog");

  const filter = filterFor(() => GateLog.find({}));

  assert.strictEqual(
    filter.societyId,
    undefined,
    "migrations and seeds must not be silently scoped"
  );

});


test("aggregations are scoped too", () => {

  const GateLog = mongoose.model("GateLog");

  runWithTenant({ societyId: SOCIETY_A, crossTenant: false }, () => {

    const agg = GateLog.aggregate([{ $group: { _id: "$scanType" } }]);

    // pre('aggregate') runs on exec; invoke the hook the way mongoose does.
    const hooks = GateLog.schema.s.hooks._pres.get("aggregate") || [];
    assert.ok(hooks.length > 0, "aggregate must have a scope hook");

    for (const hook of hooks) {
      hook.fn.call(agg);
    }

    const first = agg.pipeline()[0];

    assert.ok(first.$match, "aggregate pipeline must start with a $match");
    assert.strictEqual(
      String(first.$match.societyId),
      String(SOCIETY_A)
    );

  });

});


test("tenantScope middleware runs on every authenticated router", () => {

  const dir = path.join(__dirname, "..", "routes");

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {

    const source = fs.readFileSync(path.join(dir, file), "utf8");

    if (!source.includes("middleware/authMiddleware")) {
      continue;
    }

    assert.ok(
      source.includes("tenantScope"),
      `${file} authenticates but does not bind a tenant scope`
    );

  }

});


test("only superadmin and salesperson are cross-tenant", () => {

  const { CROSS_TENANT } = require("../utils/roles");

  assert.deepStrictEqual(
    [...CROSS_TENANT].sort(),
    ["salesperson", "superadmin"]
  );

});
