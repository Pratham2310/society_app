const express = require("express");

const router = express.Router();

const parkingController = require("../controllers/parkingController");
const communityController = require("../controllers/communityController");
const asyncHandler = require("../utils/asyncHandler");

const authMiddleware = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");


// 🔥 PROTECTED ROUTES
router.use(authMiddleware);
router.use(tenantScope);
router.use(checkApproved);



// ===================================================
// SLOTS
//
// What the app's parking screen reads. The older /map and /slot
// routes stay for the web console; these are the plural, batch-shaped
// ones the phone uses. Declared ahead of /slot/:id so "batch" is
// never taken for an id.
// ===================================================

router.get("/summary", asyncHandler(communityController.getParkingSummary));
router.get("/slots", asyncHandler(communityController.listParkingSlots));
router.post("/slots/batch", asyncHandler(communityController.createParkingSlots));
router.put("/slots/:id", asyncHandler(communityController.updateParkingSlot));
router.delete("/slots/:id", asyncHandler(communityController.deleteParkingSlot));


// ===================================================
// RESIDENT + SECRETARY
// ===================================================

// Parking map
router.get(
  "/map",
  parkingController.getParkingMap
);

// My parking
router.get(
  "/my",
  parkingController.getMyParking
);

// Find vehicle owner
router.get(
  "/find-owner",
  parkingController.findOwner
);

// Slot details / wrong parking
router.get(
  "/slot/:id",
  parkingController.getSlotDetails
);



// ===================================================
// SECRETARY ACTIONS
// ===================================================

// Create slot
router.post(
  "/slot",
  parkingController.createSlot
);

// Assign slot
router.put(
  "/assign/:id",
  parkingController.assignSlot
);

// Free slot
router.put(
  "/free/:id",
  parkingController.freeSlot
);



module.exports = router;