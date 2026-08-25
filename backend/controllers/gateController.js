const gateService = require("../services/gateService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// THE GATE
//
// Permission checks stay in the service. Most of these read one way
// for a resident and another for a guard rather than being allowed or
// refused outright, so the route table cannot decide for them.
// =======================================================

exports.getMyStatus = asyncHandler(async (req, res) => {
  const data = await gateService.getMyStatus(req);
  sendResponse(res, 200, true, "Status fetched successfully", data);
});

exports.setMyStatus = asyncHandler(async (req, res) => {
  const data = await gateService.setMyStatus(req);
  sendResponse(res, 200, true, "Status updated", data);
});

exports.raisePanic = asyncHandler(async (req, res) => {
  const data = await gateService.raisePanic(req);
  sendResponse(res, 201, true, "Alert raised. The gate has been told.", data);
});

exports.markSafe = asyncHandler(async (req, res) => {
  const data = await gateService.markSafe(req);
  sendResponse(res, 200, true, "Marked safe", data);
});

exports.acknowledgeAlert = asyncHandler(async (req, res) => {
  const data = await gateService.acknowledgeAlert(req);
  sendResponse(res, 200, true, "Alert acknowledged", data);
});

exports.listVisitors = asyncHandler(async (req, res) => {
  const data = await gateService.listVisitors(req);
  sendResponse(res, 200, true, "Visitors fetched successfully", data);
});

exports.getVisitor = asyncHandler(async (req, res) => {
  const data = await gateService.getVisitor(req);
  sendResponse(res, 200, true, "Visitor fetched successfully", data);
});

exports.createVisitor = asyncHandler(async (req, res) => {
  const data = await gateService.createVisitor(req);
  sendResponse(res, 201, true, "Pass created successfully", data);
});

exports.approveVisitor = asyncHandler(async (req, res) => {
  const data = await gateService.approveVisitor(req);
  sendResponse(res, 200, true, data.status === "approved" ? "Visitor approved" : "Visitor turned away", data);
});

exports.deleteVisitor = asyncHandler(async (req, res) => {
  const data = await gateService.deleteVisitor(req);
  sendResponse(res, 200, true, "Visitor removed", data);
});

exports.getVisitorPass = asyncHandler(async (req, res) => {
  const data = await gateService.getVisitorPass(req);
  sendResponse(res, 200, true, "Pass fetched successfully", data);
});

exports.scanPass = asyncHandler(async (req, res) => {
  const data = await gateService.scanPass(req);
  sendResponse(res, 200, true, data.direction === "entry" ? "Entry recorded" : "Exit recorded", data);
});

exports.listStaff = asyncHandler(async (req, res) => {
  const data = await gateService.listStaff(req);
  sendResponse(res, 200, true, "Staff fetched successfully", data);
});

exports.getStaff = asyncHandler(async (req, res) => {
  const data = await gateService.getStaff(req);
  sendResponse(res, 200, true, "Staff member fetched successfully", data);
});

exports.createStaff = asyncHandler(async (req, res) => {
  const data = await gateService.createStaff(req);
  sendResponse(res, 201, true, "Staff member added", data);
});

exports.updateStaff = asyncHandler(async (req, res) => {
  const data = await gateService.updateStaff(req);
  sendResponse(res, 200, true, "Staff member updated", data);
});

exports.deleteStaff = asyncHandler(async (req, res) => {
  const data = await gateService.deleteStaff(req);
  sendResponse(res, 200, true, "Staff member removed", data);
});

exports.addHouseholdStaff = asyncHandler(async (req, res) => {
  const data = await gateService.addHouseholdStaff(req);
  sendResponse(res, 201, true, "Sent to the secretary for approval", data);
});

exports.listPendingHouseholdStaff = asyncHandler(async (req, res) => {
  const data = await gateService.listPendingHouseholdStaff(req);
  sendResponse(res, 200, true, "Pending staff fetched successfully", data);
});

exports.decideHouseholdStaff = asyncHandler(async (req, res) => {
  const data = await gateService.decideHouseholdStaff(req);
  sendResponse(res, 200, true, data.verificationStatus === "approved" ? "Approved. Their gate pass is ready." : "Rejected", data);
});

exports.getStaffPass = asyncHandler(async (req, res) => {
  const data = await gateService.getStaffPass(req);
  sendResponse(res, 200, true, "Pass fetched successfully", data);
});

exports.markAttendance = asyncHandler(async (req, res) => {
  const data = await gateService.markAttendance(req);
  sendResponse(res, 200, true, "Attendance marked", data);
});

exports.listTodayAttendance = asyncHandler(async (req, res) => {
  const data = await gateService.listTodayAttendance(req);
  sendResponse(res, 200, true, "Attendance fetched successfully", data);
});

exports.attendanceReport = asyncHandler(async (req, res) => {
  const data = await gateService.attendanceReport(req);
  sendResponse(res, 200, true, "Report fetched successfully", data);
});

exports.listOnDuty = asyncHandler(async (req, res) => {
  const data = await gateService.listOnDuty(req);
  sendResponse(res, 200, true, "On-duty staff fetched successfully", data);
});

exports.listAssignments = asyncHandler(async (req, res) => {
  const data = await gateService.listAssignments(req);
  sendResponse(res, 200, true, "Assignments fetched successfully", data);
});

