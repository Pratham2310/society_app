const express = require("express");

const router = express.Router();

const paymentController =
  require("../controllers/paymentController");

const authMiddleware =
  require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");

const checkApproved =
  require("../middleware/checkApproved");

const idempotency =
  require("../middleware/idempotency");

const authorizeRoles =
  require("../middleware/requireRole").requireSocietyRole;


// PROTECTED ROUTES
router.use(authMiddleware);
router.use(tenantScope);
router.use(checkApproved);


// ===================================
// SECRETARY RECORDS OFFLINE PAYMENT
// ===================================
router.post(

  "/maintenance/:billId",

  idempotency,

  authorizeRoles(
    "secretary",
    "chairman",
    "committee_member"
  ),

  paymentController
    .recordMaintenancePayment

);

module.exports = router;