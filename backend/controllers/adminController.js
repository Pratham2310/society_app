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

//createSuperAdmin was removed. Superadmins are created only by
//backend/scripts/createSuperadmin.js, never over HTTP.