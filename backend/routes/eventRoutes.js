const express = require("express");
const router = express.Router();

const communityController = require("../controllers/communityController");
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
//The app reads attendeeCount / isAttending / isPaid off this, which
//the older handler does not compute.
router.get("/:id", communityController.getEvent);

router.post("/:id/rsvp", communityController.rsvpEvent);
router.post("/:id/pay", communityController.payForEvent);
router.get("/:id/contributors", communityController.listEventContributors);

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