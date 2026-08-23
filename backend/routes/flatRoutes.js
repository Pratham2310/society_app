const express = require("express");
const router = express.Router();

const flatController = require("../controllers/flatController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
//superadmin and salesperson are SYSTEM roles. Checking them with
//requireSocietyRole reads societyRole, which for a salesperson is the
//default "member" — it locked salespeople out of creating the wings and
//flats that onboarding a society depends on.
const systemRole =
  require("../middleware/requireRole").requireSystemRole;
const ROLES = require("../utils/roles");

// MEMBER USE (no role restriction)
router.get(
  "/",
  auth, tenantScope,
  asyncHandler(flatController.getFlat)
);

// 🔥 GET FLOORS (IMPORTANT)
router.get(
  "/floors/:wingId",
  auth, tenantScope,
  asyncHandler(flatController.getFloors)
);

// ADMIN USE
router.get(
  "/wing/:wingId",
  auth, tenantScope,
  systemRole(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.getFlatByWing)
);

router.post(
  "/",
  auth, tenantScope,
  systemRole(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.createFlat)
);

// 🔥 BULK CREATE
router.post(
  "/bulk",
  auth, tenantScope,
  systemRole(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.bulkFlatCreate)
);

module.exports = router;