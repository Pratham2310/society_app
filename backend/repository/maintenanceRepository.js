const Bill = require("../models/MaintenanceBill");

// create bill
exports.create = (data) => Bill.create(data);

// bulk create (IMPORTANT)
exports.createMany = (data) => Bill.insertMany(data);

// get all bills
exports.findAll = (filter) =>
  Bill.find(filter).sort({ createdAt: -1 }).lean();

// get one
exports.findById = (id) => Bill.findById(id);

// update
exports.update = (id, data) =>
  Bill.findByIdAndUpdate(id, data, { new: true });