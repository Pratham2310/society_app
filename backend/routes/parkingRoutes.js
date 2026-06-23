const express = require("express");

const router = express.Router();

const parkingController = require("../controllers/parkingController");

const authMiddleware = require("../middleware/authMiddleware");
const checkApproved = require("../middleware/checkApproved");


// 🔥 PROTECTED ROUTES
router.use(authMiddleware);
router.use(checkApproved);



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