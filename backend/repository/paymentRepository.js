const Payment = require("../models/Payment");

exports.create = (data, session = null) => {

  if (session) {
    return Payment.create([data], { session }).then((docs) => docs[0]);
  }

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