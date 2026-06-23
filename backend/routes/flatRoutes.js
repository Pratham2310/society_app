const express = require("express");
const router = express.Router();

const flatController = require("../controllers/flatController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const ROLES = require("../utils/roles");

// MEMBER USE (no role restriction)
router.get(
  "/",
  auth,
  asyncHandler(flatController.getFlat)
);

// 🔥 GET FLOORS (IMPORTANT)
router.get(
  "/floors/:wingId",
  auth,
  asyncHandler(flatController.getFloors)
);

// ADMIN USE
router.get(
  "/wing/:wingId",
  auth,
  role(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.getFlatByWing)
);

router.post(
  "/",
  auth,
  role(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.createFlat)
);

// 🔥 BULK CREATE
router.post(
  "/bulk",
  auth,
  role(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(flatController.bulkFlatCreate)
);

module.exports = router;