const express = require("express");
const router = express.Router();

const salesController = require("../controllers/salesController");
const authMiddleware = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;

//  DASHBOARD
router.get(
  "/dashboard",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getDashboard
);

//  SOCIETIES LIST
router.get(
  "/societies",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getSocities
);

//  ===== SPECIFIC ROUTES FIRST =====

// leadership
router.get(
  "/society/:id/leadership",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getLeadership
);

// security
router.get(
  "/society/:id/security",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getSecurityPersonnel
);

// staff full
router.get(
  "/society/:id/staff/all",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getAllStaff
);

// staff preview
router.get(
  "/society/:id/staff",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getStaffPreview
);

// residents
router.get(
  "/society/:id/residents",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getResidents
);


router.get(
  "/society/:id/services",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getServices
);

//  GENERIC ROUTE LAST (VERY IMPORTANT)
router.get(
  "/society/:id",
  authMiddleware, tenantScope,
  checkSystemRole("salesperson"),
  salesController.getSocietyDetails
);

module.exports = router;