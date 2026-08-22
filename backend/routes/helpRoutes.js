const express = require("express");

const router = express.Router();

const helpController = require(
  "../controllers/helpController"
);

const authMiddleware = require(
  "../middleware/authMiddleware"
);

const tenantScope = require(
  "../middleware/tenantScope"
);

const checkApproved = require(
  "../middleware/checkApproved"
);


// protected
router.use(authMiddleware);
router.use(tenantScope);

router.use(checkApproved);


// ================= HELPLINES =================

// create
router.post(
  "/",
  helpController.createHelpline
);

// get all
router.get(
  "/",
  helpController.getHelplines
);

// update
router.put(
  "/:id",
  helpController.updateHelpline
);

// delete
router.delete(
  "/:id",
  helpController.deleteHelpline
);


module.exports = router;