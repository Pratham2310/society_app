const communityService = require("../services/communityService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// COMMUNITY
//
// Events, notices, helpline, nearby services and parking. Permission
// checks stay in the service, because several of these read one way
// for a resident and another for the committee.
// =======================================================

exports.getEvent = asyncHandler(async (req, res) => {
  const data = await communityService.getEvent(req);
  sendResponse(res, 200, true, "Event fetched successfully", data);
});

exports.rsvpEvent = asyncHandler(async (req, res) => {
  const data = await communityService.rsvpEvent(req);
  sendResponse(
    res, 200, true,
    data.isAttending ? "You are going" : "You are no longer going",
    data
  );
});

exports.payForEvent = asyncHandler(async (req, res) => {
  const data = await communityService.payForEvent(req);
  sendResponse(res, 200, true, "Payment recorded", data);
});

exports.listEventContributors = asyncHandler(async (req, res) => {
  const data = await communityService.listEventContributors(req);
  sendResponse(res, 200, true, "Contributors fetched successfully", data);
});

exports.acknowledgeNotice = asyncHandler(async (req, res) => {
  const data = await communityService.acknowledgeNotice(req);
  sendResponse(res, 200, true, "Notice acknowledged", data);
});

exports.listHelpline = asyncHandler(async (req, res) => {
  const data = await communityService.listHelpline(req);
  sendResponse(res, 200, true, "Helpline fetched successfully", data);
});

exports.createHelpline = asyncHandler(async (req, res) => {
  const data = await communityService.createHelpline(req);
  sendResponse(res, 201, true, "Contact added successfully", data);
});

exports.updateHelpline = asyncHandler(async (req, res) => {
  const data = await communityService.updateHelpline(req);
  sendResponse(res, 200, true, "Contact updated successfully", data);
});

exports.deleteHelpline = asyncHandler(async (req, res) => {
  const data = await communityService.deleteHelpline(req);
  sendResponse(res, 200, true, "Contact removed successfully", data);
});

exports.listNearbyServices = asyncHandler(async (req, res) => {
  const data = await communityService.listNearbyServices(req);
  sendResponse(res, 200, true, "Services fetched successfully", data);
});

exports.getParkingSummary = asyncHandler(async (req, res) => {
  const data = await communityService.getParkingSummary(req);
  sendResponse(res, 200, true, "Parking fetched successfully", data);
});

exports.listParkingSlots = asyncHandler(async (req, res) => {
  const data = await communityService.listParkingSlots(req);
  sendResponse(res, 200, true, "Slots fetched successfully", data);
});

exports.createParkingSlots = asyncHandler(async (req, res) => {
  const data = await communityService.createParkingSlots(req);
  sendResponse(res, 201, true, `Created ${data.created} slot(s)`, data);
});

exports.updateParkingSlot = asyncHandler(async (req, res) => {
  const data = await communityService.updateParkingSlot(req);
  sendResponse(res, 200, true, "Slot updated successfully", data);
});

exports.deleteParkingSlot = asyncHandler(async (req, res) => {
  const data = await communityService.deleteParkingSlot(req);
  sendResponse(res, 200, true, "Slot removed successfully", data);
});
