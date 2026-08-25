const express = require("express");
const router = express.Router();

const amenityController = require("../controllers/amenityController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");

// =======================================================
// AMENITIES
//
// The "bookings/..." routes come first. Express matches in order, so
// declared the other way round "bookings" would be read as an amenity
// id by /:id.
// =======================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

router.get("/bookings/mine", asyncHandler(amenityController.listMyBookings));
router.get("/bookings/pending", asyncHandler(amenityController.listPendingBookings));
router.patch("/bookings/:bookingId/decision", asyncHandler(amenityController.decideBooking));
router.delete("/bookings/:bookingId", asyncHandler(amenityController.cancelBooking));

router.get("/", asyncHandler(amenityController.listAmenities));
router.post("/", asyncHandler(amenityController.createAmenity));

router.get("/:id", asyncHandler(amenityController.getAmenity));
router.put("/:id", asyncHandler(amenityController.updateAmenity));
router.patch("/:id", asyncHandler(amenityController.updateAmenity));
router.delete("/:id", asyncHandler(amenityController.deleteAmenity));

router.get("/:id/bookings", asyncHandler(amenityController.listAmenityBookings));
router.post("/:id/bookings", asyncHandler(amenityController.createBooking));

module.exports = router;
