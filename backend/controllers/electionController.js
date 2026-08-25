const electionService = require("../services/electionService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// ELECTIONS
//
// Status is derived rather than stored, so nothing here writes it —
// see statusOf in the service.
// =======================================================

exports.listElections = asyncHandler(async (req, res) => {
  const data = await electionService.listElections(req);
  sendResponse(res, 200, true, "Elections fetched successfully", data);
});

exports.getElection = asyncHandler(async (req, res) => {
  const data = await electionService.getElection(req);
  sendResponse(res, 200, true, "Election fetched successfully", data);
});

exports.createElection = asyncHandler(async (req, res) => {
  const data = await electionService.createElection(req);
  sendResponse(res, 201, true, "Election scheduled", data);
});

exports.addCandidate = asyncHandler(async (req, res) => {
  const data = await electionService.addCandidate(req);
  sendResponse(res, 201, true, "Candidate added", data);
});

exports.removeCandidate = asyncHandler(async (req, res) => {
  const data = await electionService.removeCandidate(req);
  sendResponse(res, 200, true, "Candidate withdrawn", data);
});

exports.vote = asyncHandler(async (req, res) => {
  const data = await electionService.vote(req);
  sendResponse(res, 201, true, "Your vote has been recorded", data);
});

exports.closeElection = asyncHandler(async (req, res) => {
  const data = await electionService.closeElection(req);
  sendResponse(res, 200, true, "Result published", data);
});

exports.cancelElection = asyncHandler(async (req, res) => {
  const data = await electionService.cancelElection(req);
  sendResponse(res, 200, true, "Election cancelled", data);
});

