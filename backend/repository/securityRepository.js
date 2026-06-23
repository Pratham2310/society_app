const ResidentSecurityStatus = require(
  "../models/ResidentSecurityStatus"
);

const VisitorRequest=require("../models/VisitorRequest");
const staffProfile=require("../models/StaffProfile");
const staffAssignments=require("../models/StaffAssignment");
const staffAtendance=require("../models/StaffAttendance");
const securityAlert=require("../models/SecurityAlert");

// Get resident status
exports.getStatus = (residentId) =>
  ResidentSecurityStatus.findOne({
    residentId
  }).lean();


// Create status
exports.createStatus = (data) =>
  ResidentSecurityStatus.create(data);


// Update status
exports.updateStatus = (residentId, data) =>
  ResidentSecurityStatus.findOneAndUpdate(
    { residentId },
    data,
    {
      new: true
    }
  );

// ================= VISITOR =================

// create visitor request
exports.createVisitorRequest = (data) =>
  VisitorRequest.create(data);


// get resident visitors
exports.getVisitorRequests = (residentId) =>
  VisitorRequest.find({
    residentId
  })
    .sort({ createdAt: -1 })
    .lean();


// get single request
exports.getVisitorById = (id) =>
  VisitorRequest.findById(id);


// update visitor
exports.updateVisitor = (id, data) =>
  VisitorRequest.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );


const StaffProfile = require(
  "../models/StaffProfile"
);

const StaffAssignment = require(
  "../models/StaffAssignment"
);


// ================= STAFF =================

// create profile
exports.createStaffProfile = (data) =>
  StaffProfile.create(data);


// create assignment
exports.createStaffAssignment = (data) =>
  StaffAssignment.create(data);


// get resident staff
exports.getResidentStaff = (residentId) =>
  StaffAssignment.find({
    residentId,
    isActive: true
  })
    .populate("staffId")
    .lean();


// get staff profile
exports.getStaffProfileById = (id) =>
  StaffProfile.findById(id);


// update staff profile
exports.updateStaffProfile = (id, data) =>
  StaffProfile.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );


// deactivate assignment
exports.deactivateStaffAssignment = (
  id
) =>
  StaffAssignment.findByIdAndUpdate(
    id,
    {
      isActive: false,
      endedAt: new Date()
    }
);


//=====================Attendance===============
// create attendance
exports.createAttendance = (data) =>
  StaffAttendance.create(data);


// get attendance by resident
exports.getResidentAttendance = (
  residentId
) =>
  StaffAttendance.find({
    residentId
  })
    .populate("staffId")
    .sort({ createdAt: -1 })
    .lean();


// get today's attendance
exports.getTodayAttendance = (
  residentId,
  staffId,
  start,
  end
) =>
  StaffAttendance.findOne({
    residentId,
    staffId,
    createdAt: {
      $gte: start,
      $lte: end
    }
  });


// update attendance
exports.updateAttendance = (
  id,
  data
) =>
  StaffAttendance.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );


// ================= ALERT =================

// create alert
exports.createSecurityAlert = (data) =>
  SecurityAlert.create(data);


// get alerts
exports.getSecurityAlerts = (
  societyId
) =>
  SecurityAlert.find({
    societyId
  })
    .populate(
      "residentId",
      "name phone"
    )
    .populate(
      "visitorRequestId"
    )
    .sort({ createdAt: -1 })
    .lean();


// get alert by id
exports.getSecurityAlertById = (
  id
) =>
  SecurityAlert.findById(id);


// update alert
exports.updateSecurityAlert = (
  id,
  data
) =>
  SecurityAlert.findByIdAndUpdate(
    id,
    data,
    { new: true }
);