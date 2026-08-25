const express = require("express");

const gateController = require("../controllers/gateController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

const securityController = require(
  "../controllers/securityController"
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

// =======================================================
// WHAT THE APP CALLS
//
// The plural, pass-shaped surface the phone uses. The singular routes
// below are the older ones and stay for the web console.
//
// Declared before them so that literal segments — "scan", "household",
// "me" — are never matched as an id by a route further down.
// =======================================================

// ---- resident status
router.get("/status/me", asyncHandler(gateController.getMyStatus));
router.patch("/status/me", asyncHandler(gateController.setMyStatus));
router.put("/status/me", asyncHandler(gateController.setMyStatus));
router.post("/status/panic", asyncHandler(gateController.raisePanic));
router.post("/status/safe", asyncHandler(gateController.markSafe));

router.patch("/alerts/:id/acknowledge", asyncHandler(gateController.acknowledgeAlert));
router.put("/alerts/:id/acknowledge", asyncHandler(gateController.acknowledgeAlert));

// ---- visitors
// "scan" first, or it is read as a visitor id.
router.post("/visitors/scan", asyncHandler(gateController.scanPass));
router.get("/visitors", asyncHandler(gateController.listVisitors));
router.post("/visitors", asyncHandler(gateController.createVisitor));
router.get("/visitors/:id", asyncHandler(gateController.getVisitor));
router.delete("/visitors/:id", asyncHandler(gateController.deleteVisitor));
router.get("/visitors/:id/pass", asyncHandler(gateController.getVisitorPass));
router.patch("/visitors/:id/approve", asyncHandler(gateController.approveVisitor));
router.put("/visitors/:id/approve", asyncHandler(gateController.approveVisitor));
router.post("/visitors/:id/entry", asyncHandler(gateController.scanPass));
router.post("/visitors/:id/exit", asyncHandler(gateController.scanPass));

// ---- staff
// "household" before ":id", same reason.
router.post("/staff/household", asyncHandler(gateController.addHouseholdStaff));
router.get("/staff/household/pending", asyncHandler(gateController.listPendingHouseholdStaff));
router.patch("/staff/:id/approval", asyncHandler(gateController.decideHouseholdStaff));
router.put("/staff/:id/approval", asyncHandler(gateController.decideHouseholdStaff));
router.get("/staff/:id/pass", asyncHandler(gateController.getStaffPass));

// ---- staff records
// These shadow the older /staff handlers below, which do not shape a
// staff row the way the app reads it and cannot create a guard login.
// The web console does not call /security at all, so nothing else
// depends on the older pair.
router.get("/staff", asyncHandler(gateController.listStaff));
router.post("/staff", asyncHandler(gateController.createStaff));
router.get("/staff/:id", asyncHandler(gateController.getStaff));
router.put("/staff/:id", asyncHandler(gateController.updateStaff));
router.delete("/staff/:id", asyncHandler(gateController.deleteStaff));

// ---- attendance and duty
router.get("/on-duty", asyncHandler(gateController.listOnDuty));
router.get("/assignments", asyncHandler(gateController.listAssignments));
router.get("/attendance/report", asyncHandler(gateController.attendanceReport));
router.post("/attendance", asyncHandler(gateController.markAttendance));
router.get("/attendance", asyncHandler(gateController.listTodayAttendance));




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