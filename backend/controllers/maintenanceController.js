const service = require("../services/maintenanceService");
const { generateBillSchema } = require("../validation/maintenanceValidation");

//  GENERATE BILLS (ADMIN)
exports.generateBills = async (req, res) => {
  try {
    const { error } = generateBillSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data = await service.generateBills(req);

    res.json({
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


//  GET MY BILLS (RESIDENT)
exports.getMyBills = async (req, res) => {
  try {
    const data = await service.getMyBills(req);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


//  GET ALL BILLS (ADMIN)
exports.getAllBills = async (req, res) => {
  try {
    const data = await service.getAllBills(req);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};


//  MARK AS PAID (ADMIN)
exports.markAsPaid = async (req, res) => {
  try {
    const data = await service.markAsPaid(req.params.id, req);

    res.json({
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


//  MARK AS PENDING (ADMIN)
exports.markPending = async (req, res) => {
  try {
    const data = await service.markPending(req.params.id);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

//  SEND REMINDER (ADMIN)
exports.sendReminder = async (req, res) => {
  try {
    const data = await service.sendReminder(req.params.id);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};