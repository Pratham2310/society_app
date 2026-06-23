const express = require("express");

const router = express.Router();

const securityController = require(
  "../controllers/securityController"
);

const authMiddleware = require(
  "../middleware/authMiddleware"
);

const checkApproved = require(
  "../middleware/checkApproved"
);


// protected
router.use(authMiddleware);
router.use(checkApproved);


// ================= STATUS =================

// get current status
router.get(
  "/status",
  securityController.getMyStatus
);

// update status
router.put(
  "/status",
  securityController.updateStatus
);

// ================= VISITOR =================

// create visitor request
router.post(
  "/visitor",
  securityController.createVisitorRequest
);

// get my visitors
router.get(
  "/visitor",
  securityController.getVisitorRequests
);

// approve
router.put(
  "/visitor/:id/approve",
  securityController.approveVisitor
);

// reject
router.put(
  "/visitor/:id/reject",
  securityController.rejectVisitor
);

// fraud
router.put(
  "/visitor/:id/fraud",
  securityController.reportFraud
);


// ================= STAFF =================

// add staff
router.post(
  "/staff",
  securityController.addStaff
);

// get my staff
router.get(
  "/staff",
  securityController.getMyStaff
);

// approve
router.put(
  "/staff/:id/approve",
  securityController.approveStaff
);

// reject
router.put(
  "/staff/:id/reject",
  securityController.rejectStaff
);

// block
router.put(
  "/staff/:id/block",
  securityController.blockStaff
);

// remove assignment
router.put(
  "/staff/remove/:id",
  securityController.removeStaff
);

// ================= ATTENDANCE =================

// mark entry
router.post(
  "/attendance/entry",
  securityController.markEntry
);

// mark exit
router.put(
  "/attendance/exit/:id",
  securityController.markExit
);

// get attendance history
router.get(
  "/attendance",
  securityController.getMyAttendance
);


// ================= ALERTS =================

// create alert
router.post(
  "/alerts",
  securityController.createSecurityAlert
);

// get alerts
router.get(
  "/alerts",
  securityController.getSecurityAlerts
);

// resolve alert
router.put(
  "/alerts/:id/resolve",
  securityController.resolveAlert
);



module.exports = router;