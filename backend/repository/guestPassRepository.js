const GuestPass = require("../models/GuestPass");

// =============================
// Create Guest Pass
// =============================
exports.create = (data) => {
  return GuestPass.create(data);
};

// =============================
// Find By ID
// =============================
exports.findById = (id) => {
  return GuestPass.findById(id)
    .populate("residentId", "name phone profilePicture")
    .populate("flatId", "flatNumber")
    .populate("wingId", "name");
};

// =============================
// Find By QR Token
// =============================
exports.findByToken = (token) => {
  return GuestPass.findOne({
    qrToken: token,
  });
};

// =============================
// Find Active Pass By Token
// =============================
exports.findActiveByToken = (token) => {
  return GuestPass.findOne({
    qrToken: token,
    status: "active",
  });
};

// =============================
// Resident's Guest Passes
// =============================
exports.findMyPasses = (residentId) => {
  return GuestPass.find({
    residentId,
  }).sort({
    createdAt: -1,
  });
};

// =============================
// Society Guest Passes
// =============================
exports.findAll = (filter) => {
  return GuestPass.find(filter)
    .sort({
      createdAt: -1,
    })
    .lean();
};

// =============================
// Update Pass
// =============================
exports.update = (id, data) => {
  return GuestPass.findByIdAndUpdate(id, data, {
    new: true,
  });
};

// =============================
// Delete Pass
// =============================
exports.delete = (id) => {
  return GuestPass.findByIdAndDelete(id);
};