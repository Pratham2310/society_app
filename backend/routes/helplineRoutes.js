const express = require("express");
const router = express.Router();

const communityController = require("../controllers/communityController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");

// =======================================================
// HELPLINE
//
// The app asks for /helpline; the existing /help routes are what the
// web console uses and stay as they are. Both read the same model —
// this one translates title/phone to the label/number the app expects.
// =======================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

router.get("/", asyncHandler(communityController.listHelpline));
router.post("/", asyncHandler(communityController.createHelpline));
router.patch("/:id", asyncHandler(communityController.updateHelpline));
router.delete("/:id", asyncHandler(communityController.deleteHelpline));

module.exports = router;
