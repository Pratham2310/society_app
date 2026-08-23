const { runWithTenant } = require("../utils/tenantContext");
const { CROSS_TENANT, normaliseRole } = require("../utils/roles");

// =======================================================
// TENANT SCOPE
//
// Binds the caller's societyId to the async context for the rest
// of the request, so the societyScope Mongoose plugin can constrain
// every query without each repository having to remember.
//
// Must run after authMiddleware.
// =======================================================

module.exports = (req, res, next) => {

  const systemRole = normaliseRole(req.user?.systemRole);

  // superadmin and salesperson are the only roles that legitimately
  // read across societies, and doing so is now an explicit property
  // of the request rather than an accident of a missing filter.
  const crossTenant = CROSS_TENANT.includes(systemRole);

  runWithTenant(
    {
      societyId: req.user?.societyId || null,
      userId: req.user?.id || null,
      crossTenant,
    },
    () => next()
  );

};
