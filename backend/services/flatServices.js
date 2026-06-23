const Flat = require("../models/Flats");

// 🔥 FOR ONBOARDING (WITH SESSION)
exports.bulkCreateFlats = async (flats, session) => {
  return await Flat.insertMany(flats, { session });
};

// 🔵 FOR API (WITHOUT SESSION)
exports.bulkFlatCreate = async (
  societyId,
  wingId,
  totalFloors,
  totalFlatsPerFloor
) => {

  const flats = [];

  for (let floor = 1; floor <= totalFloors; floor++) {
    for (let i = 1; i <= totalFlatsPerFloor; i++) {

      const flatNumber = `${floor}${String(i).padStart(2, "0")}`;

      flats.push({
        societyId,
        wingId,
        floor,
        flatNumber,
        isOccupied: false
      });
    }
  }

  return await Flat.insertMany(flats);
};

// GET flats by wing + floor
exports.getFlatByWingAndFloor = async (wingId, floor) => {
  return await Flat.find({ wingId, floor }).select("flatNumber");
};

// GET floors
exports.getFloorsByWing = async (wingId) => {
  const floors = await Flat.distinct("floor", { wingId });
  return floors.sort((a, b) => a - b);
};

// GET flats by wing
exports.getFlatByWing = async (wingId) => {
  return await Flat.find({ wingId }).sort({ floor: 1 });
};

// CREATE single flat
exports.createFlat = async (societyId, wingId, floor, flatNumber) => {
  return await Flat.create({
    societyId,
    wingId,
    floor,
    flatNumber
  });
};