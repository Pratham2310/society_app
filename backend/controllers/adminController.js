const adminService = require("../services/adminServices");

exports.createSalesperson = async (req, res) => {
  try {
    const salesPerson = await adminService.createSalesperson(req.body, req.user);

    res.status(201).json({
      message: "Salesperson created",
      data: salesPerson
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.createSuperAdmin = async (req, res) => {
  try {

    const superAdmin = await adminService.createSuperAdmin(req.body);

    res.status(201).json({
      message: "SuperAdmin created",
      data: superAdmin
    });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};