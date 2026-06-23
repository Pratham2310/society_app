const express = require("express");

const router = express.Router();

const paymentController =
  require("../controllers/paymentController");

const authMiddleware =
  require("../middleware/authMiddleware");

const checkApproved =
  require("../middleware/checkApproved");

const authorizeRoles =
  require("../middleware/authorizeRoles");


// PROTECTED ROUTES
router.use(authMiddleware);
router.use(checkApproved);


// ===================================
// SECRETARY RECORDS OFFLINE PAYMENT
// ===================================
router.post(

  "/maintenance/:billId",

  authorizeRoles(
    "secretary",
    "chairman",
    "committee_member"
  ),

  paymentController
    .recordMaintenancePayment

);

module.exports = router;