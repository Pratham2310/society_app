const express = require("express");
const router = express.Router();

const communityController = require("../controllers/communityController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");

// =======================================================
// PARTNER SERVICES
//
// The businesses the platform has attached to this society. The
// catalogue behind them is cross-tenant and managed through /services
// by the salespeople; residents only ever see their own slice, which
// is why this route takes no society id.
// =======================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

router.get("/mine", asyncHandler(communityController.listNearbyServices));

module.exports = router;
