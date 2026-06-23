const Wing = require("../models/Wing");
const Society = require("../models/Society");
const {bulkCreateFlats} = require("../services/flatServices");
const AppError = require("../utils/appError");

exports.createWing = async (data, session) => {

  const { societyId, name, totalFloors, flatsPerFloor } = data;

  if (!name || !societyId || !totalFloors || !flatsPerFloor) {
    throw new AppError("All fields are required", 400);
  }

  if (totalFloors <= 0 || flatsPerFloor <= 0) {
    throw new AppError("Floors and flats must be greater than 0", 400);
  }

  const society = await Society.findById(societyId).session(session);
  if (!society) {
    throw new AppError("Society not found", 404);
  }

  const existingWing = await Wing.findOne({ name, societyId }).session(session);
  if (existingWing) {
    throw new AppError("Wing already exists in this society", 400);
  }

  // ✅ CREATE WING WITH SESSION
  const wingArr = await Wing.create([{
    name,
    societyId,
    totalFloors,
    flatsPerFloor
  }], { session });

  const wing = wingArr[0];

  // Generate flats
  const flats = [];

  for (let floor = 1; floor <= totalFloors; floor++) {
    for (let i = 1; i <= flatsPerFloor; i++) {

      const flatNumber = `${floor}${String(i).padStart(2, "0")}`;

      flats.push({
        societyId,
        wingId: wing._id,
        floor,
        flatNumber,
        isOccupied: false
      });
    }
  }

  // ✅ PASS SESSION
  await bulkCreateFlats(flats, session);

  // ✅ UPDATE WITH SESSION
  await Society.findByIdAndUpdate(
    societyId,
    {
      hasWingStructure: true,
      $inc: { totalWings: 1 }
    },
    { session }
  );

  return wing;
};