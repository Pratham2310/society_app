const amenityService = require("../services/amenityService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// AMENITIES
//
// Permission checks stay in the service: the booking list reads the
// same for everyone, but who may approve one does not.
// =======================================================

exports.listAmenities = asyncHandler(async (req, res) => {
  const data = await amenityService.listAmenities(req);
  sendResponse(res, 200, true, "Amenities fetched successfully", data);
});

exports.getAmenity = asyncHandler(async (req, res) => {
  const data = await amenityService.getAmenity(req);
  sendResponse(res, 200, true, "Amenity fetched successfully", data);
});

exports.createAmenity = asyncHandler(async (req, res) => {
  const data = await amenityService.createAmenity(req);
  sendResponse(res, 201, true, "Amenity added successfully", data);
});

exports.updateAmenity = asyncHandler(async (req, res) => {
  const data = await amenityService.updateAmenity(req);
  sendResponse(res, 200, true, "Amenity updated successfully", data);
});

exports.deleteAmenity = asyncHandler(async (req, res) => {
  const data = await amenityService.deleteAmenity(req);
  sendResponse(res, 200, true, "Amenity removed successfully", data);
});

exports.listAmenityBookings = asyncHandler(async (req, res) => {
  const data = await amenityService.listAmenityBookings(req);
  sendResponse(res, 200, true, "Bookings fetched successfully", data);
});

exports.listMyBookings = asyncHandler(async (req, res) => {
  const data = await amenityService.listMyBookings(req);
  sendResponse(res, 200, true, "Your bookings fetched successfully", data);
});

exports.listPendingBookings = asyncHandler(async (req, res) => {
  const data = await amenityService.listPendingBookings(req);
  sendResponse(res, 200, true, "Pending bookings fetched successfully", data);
});

exports.createBooking = asyncHandler(async (req, res) => {
  const data = await amenityService.createBooking(req);
  sendResponse(res, 201, true, data.status === "pending"
    ? "Requested. The committee will confirm it."
    : "Booked", data);
});

exports.decideBooking = asyncHandler(async (req, res) => {
  const data = await amenityService.decideBooking(req);
  sendResponse(res, 200, true, data.status === "confirmed" ? "Booking confirmed" : "Booking declined", data);
});

exports.cancelBooking = asyncHandler(async (req, res) => {
  const data = await amenityService.cancelBooking(req);
  sendResponse(res, 200, true, "Booking cancelled", data);
});

