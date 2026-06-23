const Payment = require("../models/Payment");

exports.create = (data) => {
  return Payment.create(data);
};

exports.findById = (id) => {
  return Payment.findById(id);
};

exports.findAll = (filter) => {
  return Payment.find(filter)
    .sort({ createdAt: -1 })
    .lean();
};