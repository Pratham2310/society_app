const express = require("express");

// =======================================================
// API ROUTE TABLE
//
// One place that says what the API surface is. app.js mounts
// this whole router under a version prefix, so adding /api/v2
// later means mounting a second table — never editing paths
// scattered across app.js.
// =======================================================

const MOUNTS = [
  ["/auth", require("./authRoutes")],
  ["/societies", require("./societyRoutes")],
  ["/flats", require("./flatRoutes")],
  ["/wings", require("./wingRoutes")],
  ["/users", require("./userRoutes")],
  ["/residents/dashboard", require("./dashboardRoutes")],
  ["/notices", require("./noticeRoutes")],
  ["/notifications", require("./notificationRoutes")],
  ["/admin", require("./adminRoutes")],
  ["/onboarding", require("./onboardingRoutes")],
  ["/sales", require("./salesRoutes")],
  ["/services", require("./serviceRoutes")],
  ["/amenities", require("./amenityRoutes")],
  ["/elections", require("./electionRoutes")],
  ["/events", require("./eventRoutes")],
  ["/complaints", require("./complaintRoutes")],
  ["/finance", require("./financeRoutes")],
  ["/maintenance", require("./maintenanceRoutes")],
  ["/expenses", require("./expenseRoutes")],
  ["/community-funds", require("./communityFundRoutes")],
  ["/parking", require("./parkingRoutes")],
  ["/security", require("./securityRoutes")],
  ["/map", require("./mapRoutes")],
  ["/help", require("./helpRoutes")],
  ["/helpline", require("./helplineRoutes")],
  ["/partner-services", require("./partnerServiceRoutes")],
  ["/uploads", require("./uploadRoutes")],
  ["/payments", require("./paymentRoutes")],
  ["/guest-passes", require("./guestPassRoutes")],
  ["/gate-log", require("./gateLogRoutes")],
  ["/visitor-approvals", require("./visitorApprovalRoutes")],
];

const buildApiRouter = () => {

  const router = express.Router();

  for (const [path, handler] of MOUNTS) {
    router.use(path, handler);
  }

  return router;

};

module.exports = { buildApiRouter, MOUNTS };
