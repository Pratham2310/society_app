const GateLog = require("../models/GateLog");

// =============================
// Create New Gate Log
// =============================
exports.create = (data) => {
  return GateLog.create(data);
};

// =============================
// Find By ID
// =============================
exports.findById = (id) => {
  return GateLog.findById(id)
    .populate("guestPassId")
    .populate("residentId", "name phone")
    .populate("guardId", "name")
    .populate("flatId", "flatNumber");
};

// =============================
// Find All Logs
// =============================
exports.findAll = (filter) => {
  return GateLog.find(filter)
    .sort({ scanTime: -1 })
    .lean();
};

// =============================
// Get Logs Of One Guest Pass
// =============================
exports.findByGuestPass = (guestPassId) => {
  return GateLog.find({
    guestPassId,
  }).sort({
    scanTime: -1,
  });
};

// =============================
// Latest Scan
// =============================
exports.findLatestScan = (guestPassId) => {
  return GateLog.findOne({
    guestPassId,
  }).sort({
    scanTime: -1,
  });
};

// =============================
// Update Log
// (Rarely Used)
// =============================
exports.update = (id, data) => {
  return GateLog.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
    }
  );
};

// =============================
// Delete Log
// =============================
exports.delete = (id) => {
  return GateLog.findByIdAndDelete(id);
};