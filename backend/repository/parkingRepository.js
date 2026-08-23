const ParkingSlot = require("../models/ParkingSlot");
const ParkingAllotment = require("../models/ParkingAllotment");


// ================= SLOT =================

// Create slot
exports.createSlot = (data) => ParkingSlot.create(data);

// Get all slots (for map)
exports.getSlots = (filter) =>
  ParkingSlot.find(filter).sort({ slotNumber: 1 }).lean();

// Get single slot
exports.getSlotById = (id) => ParkingSlot.findById(id);

// Update slot
exports.updateSlot = (id, data, session = null) =>
  ParkingSlot.findByIdAndUpdate(id, data, {
    new: true,
    ...(session ? { session } : {}),
  });


// ================= ALLOTMENT =================

// Create allotment
exports.createAllotment = (data, session = null) => {

  if (session) {
    return ParkingAllotment.create([data], { session }).then((d) => d[0]);
  }

  return ParkingAllotment.create(data);

};

// Get active allotment by slot
exports.getActiveAllotmentBySlot = (slotId) =>
  ParkingAllotment.findOne({ slotId, isActive: true });

// Get active allotment by vehicle (for search)
exports.getActiveAllotmentByVehicle = (vehicleNumber) =>
  ParkingAllotment.findOne({
    vehicleNumber,
    isActive: true
  })
    .populate("ownerId", "name phone flatNumber")
    .populate("slotId", "slotNumber")
    .lean();

// Deactivate allotment
exports.deactivateAllotment = (id, session = null) =>
  ParkingAllotment.findByIdAndUpdate(id, { isActive: false }, {
    ...(session ? { session } : {}),
  });

// Get user's parking
exports.getUserAllotment = (userId) =>
  ParkingAllotment.findOne({
    ownerId: userId,
    isActive: true
  })
    .populate("slotId")
    .lean();