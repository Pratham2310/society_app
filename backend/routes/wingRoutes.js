const express = require("express");
const router = express.Router();

const wingController = require("../controllers/wingController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const ROLES = require("../utils/roles");

// ✅ CREATE WING
router.post(
  "/",
  auth,
  role(ROLES.SUPERADMIN, ROLES.SALESPERSON),
  asyncHandler(wingController.createWing)
);

// ✅ GET WINGS BY SOCIETY
router.get(
  "/society/:societyId",
  auth,
  asyncHandler(wingController.getWingsBySociety)
);

// ✅ GET SINGLE WING
router.get(
  "/:wingId",
  auth,
  asyncHandler(wingController.getWingById)
);

module.exports = router;