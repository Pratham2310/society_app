const parkingService = require("../services/parkingService");


// ===================================================
// CREATE SLOT
// ===================================================
exports.createSlot = async (req, res) => {

  try {

    const data =
      await parkingService.createSlot(req);

    res.status(201).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// GET PARKING MAP
// ===================================================
exports.getParkingMap = async (req, res) => {

  try {

    const data =
      await parkingService.getParkingMap(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// ASSIGN SLOT
// ===================================================
exports.assignSlot = async (req, res) => {

  try {

    const data =
      await parkingService.assignSlot(
        req.params.id,
        req
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// FREE SLOT
// ===================================================
exports.freeSlot = async (req, res) => {

  try {

    const data =
      await parkingService.freeSlot(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// FIND OWNER
// ===================================================
exports.findOwner = async (req, res) => {

  try {

    const data =
      await parkingService.findOwner(
        req.query.vehicleNumber
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// MY PARKING
// ===================================================
exports.getMyParking = async (req, res) => {

  try {

    const data =
      await parkingService.getMyParking(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};



// ===================================================
// SLOT DETAILS
// ===================================================
exports.getSlotDetails = async (req, res) => {

  try {

    const data =
      await parkingService.getSlotDetails(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (err) {

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message
    });

  }
};