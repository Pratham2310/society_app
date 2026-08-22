const express = require("express");
const router = express.Router();

const controller = require("../controllers/serviceController");
const auth = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;

// CREATE
router.post("/", auth, tenantScope, checkSystemRole("salesperson"), controller.createService);

// GET ALL
router.get("/", auth, tenantScope, checkSystemRole("salesperson"), controller.getAllServices);

// UPDATE
router.put("/:id", auth, tenantScope, checkSystemRole("salesperson"), controller.updateService);

// ASSIGN
router.post("/:id/assign", auth, tenantScope, checkSystemRole("salesperson"), controller.assignService);

// 🔥 UNASSIGN
router.post("/:id/unassign", auth, tenantScope, checkSystemRole("salesperson"), controller.unassignService);

// 🔥 LINKED SOCIETIES
router.get("/:id/societies", auth, tenantScope, checkSystemRole("salesperson"), controller.getLinkedSocieties);

module.exports = router;