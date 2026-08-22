const { getSocietyId, isCrossTenant } = require("../../utils/tenantContext");

// =======================================================
// SOCIETY SCOPE PLUGIN
//
// Applied to every schema that has a societyId path. When a
// request carries a tenant context, this injects societyId into
// the filter of every read and write.
//
// Why a plugin rather than fixing each repository call:
// there were 40 findById-style calls across 14 repositories that
// took a bare _id. Patching them one by one leaves the next new
// query one forgotten filter away from a cross-tenant leak. This
// makes the safe behaviour the default and the unsafe one explicit.
//
// No context (scripts, seeds, tests) means no injection.
// crossTenant (superadmin, salesperson) also bypasses it.
// =======================================================

const QUERY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "replaceOne",
];

module.exports = function societyScope(schema) {

  // Only meaningful for society-owned collections.
  if (!schema.path("societyId")) {
    return;
  }

  const applyScope = function () {

    if (isCrossTenant()) {
      return;
    }

    const societyId = getSocietyId();

    if (!societyId) {
      return;
    }

    const filter = this.getFilter();

    // Never widen an existing, deliberate constraint.
    if (filter.societyId === undefined) {
      this.where({ societyId });
    }

  };

  for (const hook of QUERY_HOOKS) {
    schema.pre(hook, applyScope);
  }

  // Aggregations bypass query middleware, so constrain the pipeline.
  schema.pre("aggregate", function () {

    if (isCrossTenant()) {
      return;
    }

    const societyId = getSocietyId();

    if (!societyId) {
      return;
    }

    const pipeline = this.pipeline();

    const alreadyScoped =
      pipeline.length &&
      pipeline[0].$match &&
      pipeline[0].$match.societyId !== undefined;

    if (!alreadyScoped) {
      pipeline.unshift({ $match: { societyId } });
    }

  });

  // Stamp societyId on insert when the caller omitted it.
  // Declared without a `next` parameter: mongoose treats a zero-arity
  // hook as synchronous and does not pass a callback.
  schema.pre("save", function () {

    if (!this.societyId && !isCrossTenant()) {

      const societyId = getSocietyId();

      if (societyId) {
        this.societyId = societyId;
      }

    }

  });

};
