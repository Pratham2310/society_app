const express = require("express");
const router = express.Router();

const controller = require("../controllers/serviceController");
const auth = require("../middleware/authMiddleware");
const checkSystemRole = require("../middleware/checkSystemRole");

// CREATE
router.post("/", auth, checkSystemRole("salesperson"), controller.createService);

// GET ALL
router.get("/", auth, checkSystemRole("salesperson"), controller.getAllServices);

// UPDATE
router.put("/:id", auth, checkSystemRole("salesperson"), controller.updateService);

// ASSIGN
router.post("/:id/assign", auth, checkSystemRole("salesperson"), controller.assignService);

// 🔥 UNASSIGN
router.post("/:id/unassign", auth, checkSystemRole("salesperson"), controller.unassignService);

// 🔥 LINKED SOCIETIES
router.get("/:id/societies", auth, checkSystemRole("salesperson"), controller.getLinkedSocieties);

module.exports = router;