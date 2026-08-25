const { permissionsFor } = require("../config/permissions");
const AppError = require("../utils/appError");

// =======================================================
// REQUIRE PERMISSION
//
// The counterpart to the list the app fetches at sign-in. Guarding a
// route by permission rather than by naming roles means the two cannot
// drift: adding a role to config/permissions.js grants it here too,
// and nowhere else needs editing.
//
// Roles are still the right guard where the rule genuinely is about
// who someone is rather than what they may do — requireSocietyRole
// stays for those.
// =======================================================

const requirePermission = (...required) => {

  if (!required.length) {
    throw new Error("requirePermission needs at least one permission");
  }

  return (req, res, next) => {

    if (!req.user) {
      return next(new AppError("Sign in to continue.", 401));
    }

    const held = permissionsFor(req.user);

    // Any of the listed permissions is enough. A route needing two
    // unrelated ones is a sign it should be two routes.
    const allowed = required.some((permission) => held.includes(permission));

    if (!allowed) {
      return next(
        new AppError("You do not have permission to do that.", 403)
      );
    }

    return next();

  };

};

module.exports = { requirePermission };
