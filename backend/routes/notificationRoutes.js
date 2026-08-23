const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificationController");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");
const {
  registerDeviceSchema,
  unregisterDeviceSchema,
} = require("../validation/notificationValidation");

router.use(auth);
router.use(tenantScope);

// NOTE: device registration is deliberately NOT behind checkApproved.
// A pending resident still needs to receive "your account was approved".

//device tokens
router.post("/devices", validate(registerDeviceSchema), notificationController.registerDevice);
router.delete("/devices", validate(unregisterDeviceSchema), notificationController.unregisterDevice);

//inbox — literal paths before any parameterised route
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllRead);
router.get("/", notificationController.getNotifications);
router.patch("/:notificationId/read", notificationController.markRead);

module.exports = router;
