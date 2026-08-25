const meService = require("../services/meService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// THE SIGNED-IN USER
//
// Every handler works from req.user. None of them take an id for whose
// record to touch, which is what keeps one resident out of another's
// profile without a scoping check in each one.
// =======================================================

exports.getMe = asyncHandler(async (req, res) => {
  const data = await meService.getMe(req);
  sendResponse(res, 200, true, "Profile fetched successfully", data);
});

exports.getMyPermissions = asyncHandler(async (req, res) => {
  const data = await meService.getMyPermissions(req);
  sendResponse(res, 200, true, "Permissions fetched successfully", data);
});

exports.requestProfileChange = asyncHandler(async (req, res) => {
  const data = await meService.requestProfileChange(req);
  sendResponse(
    res, 202, true,
    "Your changes were sent to the secretary for review",
    data
  );
});

exports.listProfileChangeRequests = asyncHandler(async (req, res) => {
  const data = await meService.listProfileChangeRequests(req);
  sendResponse(res, 200, true, "Change requests fetched successfully", data);
});

exports.decideProfileChange = asyncHandler(async (req, res) => {
  const data = await meService.decideProfileChange(req);
  sendResponse(
    res, 200, true,
    data.status === "approved" ? "Change approved" : "Change rejected",
    data
  );
});

exports.setAvatar = asyncHandler(async (req, res) => {
  const data = await meService.setAvatar(req);
  sendResponse(res, 200, true, "Photo updated successfully", data);
});

exports.listVehicles = asyncHandler(async (req, res) => {
  const data = await meService.listVehicles(req);
  sendResponse(res, 200, true, "Vehicles fetched successfully", data);
});

exports.addVehicle = asyncHandler(async (req, res) => {
  const data = await meService.addVehicle(req);
  sendResponse(res, 201, true, "Vehicle added successfully", data);
});

exports.removeVehicle = asyncHandler(async (req, res) => {
  const data = await meService.removeVehicle(req);
  sendResponse(res, 200, true, "Vehicle removed successfully", data);
});

exports.registerPushToken = asyncHandler(async (req, res) => {
  const data = await meService.registerPushToken(req);
  sendResponse(res, 200, true, "Device registered for alerts", data);
});

exports.removePushToken = asyncHandler(async (req, res) => {
  const data = await meService.removePushToken(req);
  sendResponse(res, 200, true, "Device removed from alerts", data);
});

exports.getMySociety = asyncHandler(async (req, res) => {
  const data = await meService.getMySociety(req);
  sendResponse(res, 200, true, "Society fetched successfully", data);
});

exports.updateMySocietyPayment = asyncHandler(async (req, res) => {
  const data = await meService.updateMySocietyPayment(req);
  sendResponse(res, 200, true, "Payment details updated successfully", data);
});
