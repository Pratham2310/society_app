const express = require("express");
const router = express.Router();

const eventController = require("../controllers/eventController");
const authMiddleware = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");
const checkRole =
  require("../middleware/requireRole").requireSocietyRole;

router.use(authMiddleware);
router.use(tenantScope);
router.use(checkApproved);

// CREATE
router.post(
  "/",
  eventController.createEvent
);

// GET ALL
router.get("/", eventController.getEvents);

// GET SINGLE
router.get("/:id", eventController.getEventById);

// UPDATE
router.put(
  "/:id",
  eventController.updateEvent
);

// DELETE
router.delete(
  "/:id",
  eventController.deleteEvent
);

module.exports = router;