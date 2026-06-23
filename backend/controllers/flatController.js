const flatService = require("../services/flatServices");

// GET flats by wing + floor
exports.getFlat = async (req, res) => {
  try {
    const { wingId, floor } = req.query;

    const flats = await flatService.getFlatByWingAndFloor(wingId, floor);

    res.status(200).json({ success: true, flats });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET floors
exports.getFloors = async (req, res) => {
  try {
    const { wingId } = req.params;

    const floors = await flatService.getFloorsByWing(wingId);

    res.json({ success: true, floors });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET flats by wing
exports.getFlatByWing = async (req, res) => {
  try {
    const { wingId } = req.params;

    const flats = await flatService.getFlatByWing(wingId);

    res.status(200).json({ success: true, flats });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// CREATE flat
exports.createFlat = async (req, res) => {
  try {
    const { societyId, wingId, floor, flatNumber } = req.body;

    const flat = await flatService.createFlat(
      societyId,
      wingId,
      floor,
      flatNumber
    );

    res.status(201).json({ success: true, flat });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// BULK CREATE (API)
exports.bulkFlatCreate = async (req, res) => {
  try {
    const { societyId, wingId, totalFloors, totalFlatsPerFloor } = req.body;

    const flats = await flatService.bulkFlatCreate(
      societyId,
      wingId,
      totalFloors,
      totalFlatsPerFloor
    );

    res.status(201).json({
      success: true,
      message: "Flats created",
      count: flats.length
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};