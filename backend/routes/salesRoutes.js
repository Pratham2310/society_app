const express = require("express");
const router = express.Router();

const salesController = require("../controllers/salesController");
const authMiddleware = require("../middleware/authMiddleware");
const checkSystemRole = require("../middleware/checkSystemRole");

//  DASHBOARD
router.get(
  "/dashboard",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getDashboard
);

//  SOCIETIES LIST
router.get(
  "/societies",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getSocities
);

//  ===== SPECIFIC ROUTES FIRST =====

// leadership
router.get(
  "/society/:id/leadership",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getLeadership
);

// security
router.get(
  "/society/:id/security",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getSecurityPersonnel
);

// staff full
router.get(
  "/society/:id/staff/all",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getAllStaff
);

// staff preview
router.get(
  "/society/:id/staff",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getStaffPreview
);

// residents
router.get(
  "/society/:id/residents",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getResidents
);


router.get(
  "/society/:id/services",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getServices
);

//  GENERIC ROUTE LAST (VERY IMPORTANT)
router.get(
  "/society/:id",
  authMiddleware,
  checkSystemRole("salesperson"),
  salesController.getSocietyDetails
);

module.exports = router;