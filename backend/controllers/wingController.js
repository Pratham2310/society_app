const wingService = require("../services/wingServices");

// ✅ CREATE WING
exports.createWing = async (req, res) => {
  const wing = await wingService.createWing(req.body);

  res.status(201).json({
    success: true,
    message: "Wing created successfully",
    wing
  });
};

// ✅ GET WINGS BY SOCIETY
exports.getWingsBySociety = async (req, res) => {
  const wings = await wingService.getWingsBySociety(req.params.societyId);

  res.json({
    success: true,
    wings
  });
};

// ✅ GET SINGLE WING
exports.getWingById = async (req, res) => {
  const wing = await wingService.getWingById(req.params.wingId);

  res.json({
    success: true,
    wing
  });
};