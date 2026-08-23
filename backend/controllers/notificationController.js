const notificationService = require("../services/notificationService");
const pushService = require("../services/pushService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");
const AppError = require("../utils/appError");

// =======================================================
// DEVICE REGISTRATION
// =======================================================

exports.registerDevice = asyncHandler(async (req, res) => {

  const { token, platform, deviceId } = req.body;

  const ok = await pushService.registerToken(req.user.id, {
    token,
    platform,
    deviceId,
  });

  if (!ok) {
    throw new AppError(
      "Not a valid Expo push token. Expected ExponentPushToken[...].",
      400
    );
  }

  sendResponse(res, 201, true, "Device registered for notifications");

});

exports.unregisterDevice = asyncHandler(async (req, res) => {

  await pushService.unregisterToken(req.user.id, req.body.token);

  // Idempotent by design: signing out twice is not an error.
  sendResponse(res, 200, true, "Device unregistered");

});

// =======================================================
// INBOX
// =======================================================

exports.getNotifications = asyncHandler(async (req, res) => {

  const { items, meta } = await notificationService.list(req.user, req.query);

  res.status(200).json({
    success: true,
    message: "Notifications fetched successfully",
    data: items,
    meta,
  });

});

exports.getUnreadCount = asyncHandler(async (req, res) => {

  const count = await notificationService.unreadCount(req.user);

  sendResponse(res, 200, true, "Unread count fetched successfully", { count });

});

exports.markRead = asyncHandler(async (req, res) => {

  const updated = await notificationService.markRead(
    req.params.notificationId,
    req.user
  );

  if (!updated) {
    throw new AppError("Notification not found", 404);
  }

  sendResponse(res, 200, true, "Notification marked as read", updated);

});

exports.markAllRead = asyncHandler(async (req, res) => {

  const count = await notificationService.markAllRead(req.user);

  sendResponse(res, 200, true, "All notifications marked as read", { count });

});
