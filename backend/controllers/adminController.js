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

exports.listSalespeople = async (req, res, next) => {
  try {
    const salespeople = await adminService.listSalespeople();
    res.json({ message: "Salespeople fetched successfully", data: salespeople });
  } catch (err) {
    next(err);
  }
};


exports.updateSalesperson = async (req, res, next) => {
  try {
    const updated = await adminService.updateSalesperson(req.params.id, req.body);
    res.json({ message: "Salesperson updated", data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteSalesperson = async (req, res, next) => {
  try {
    await adminService.deleteSalesperson(req.params.id);
    res.json({ message: "Salesperson deleted", data: null });
  } catch (err) {
    next(err);
  }
};
