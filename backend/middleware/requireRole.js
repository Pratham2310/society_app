const AppError = require("../utils/appError");
const { normaliseRole, CROSS_TENANT, SYSTEM_ROLES } = require("../utils/roles");

// =======================================================
// ROLE GUARDS
//
// Replaces roleMiddleware, authorizeRoles, checkRole,
// checkSocietyRole and checkSystemRole, which checked five
// different properties -- `role`, and two misspellings of
// societyRole -- and disagreed about which one mattered.
//
// authMiddleware sets exactly two: req.user.systemRole and
// req.user.societyRole. These read those and nothing else.
// =======================================================

// Platform-level roles: superadmin, salesperson.
const requireSystemRole = (...allowed) => {

  const permitted = allowed.map(normaliseRole);

  return (req, res, next) => {

    const role = normaliseRole(req.user?.systemRole);

    // A superadmin owns the platform, so anything a salesperson may do
    // they may do too. Without this the superadmin console could not
    // onboard a society or reach any /sales route — both 403 — even
    // though onboarding is explicitly a superadmin capability.
    // requireSocietyRole already grants the same superset.
    if (role === SYSTEM_ROLES.SUPERADMIN) {
      return next();
    }

    if (!role || !permitted.includes(role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    return next();

  };

};

// Roles inside a single society: chairman, secretary, member, security...
// Superadmin passes any society check — it is the platform owner.
const requireSocietyRole = (...allowed) => {

  const permitted = allowed.map(normaliseRole);

  return (req, res, next) => {

    const systemRole = normaliseRole(req.user?.systemRole);

    if (systemRole === "superadmin") {
      return next();
    }

    const role = normaliseRole(req.user?.societyRole);

    if (!role || !permitted.includes(role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    return next();

  };

};

// Guards the cross-tenant surface explicitly, so reading across
// societies is always a deliberate capability rather than the
// accidental result of a missing societyId filter.
const requireCrossTenant = () => requireSystemRole(...CROSS_TENANT);

module.exports = {
  requireSystemRole,
  requireSocietyRole,
  requireCrossTenant,
};
