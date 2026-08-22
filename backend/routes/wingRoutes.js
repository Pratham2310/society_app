const express = require("express");
const router = express.Router();

const wingController = require("../controllers/wingController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
//superadmin and salesperson are SYSTEM roles, so these must be checked
//with requireSystemRole. requireSocietyRole reads societyRole, which for
//a salesperson is the default "member" — it locked salespeople out of
//the onboarding they are responsible for.
const systemRole =
  require("../middleware/requireRole").requireSystemRole;
const ROLES = require("../utils/roles");

// ✅ CREATE WING
router.post(
  "/",
  auth, tenantScope,
  systemRole(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(wingController.createWing)
);

// ✅ GET WINGS BY SOCIETY
router.get(
  "/society/:societyId",
  auth, tenantScope,
  asyncHandler(wingController.getWingsBySociety)
);

// ✅ GET SINGLE WING
router.get(
  "/:wingId",
  auth, tenantScope,
  asyncHandler(wingController.getWingById)
);

module.exports = router;