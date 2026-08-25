const financeService = require("../services/financeService");
const asyncHandler = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");

// =======================================================
// FINANCE
//
// Permission checks live in the service rather than the route table,
// because several of these read differently depending on what the
// caller holds: a resident's maintenance list is their own bills, a
// treasurer's is the society's.
// =======================================================

exports.getOverview = asyncHandler(async (req, res) => {
  const data = await financeService.getOverview(req);
  sendResponse(res, 200, true, "Overview fetched successfully", data);
});

exports.listMaintenance = asyncHandler(async (req, res) => {
  const data = await financeService.listMaintenance(req);
  sendResponse(res, 200, true, "Maintenance fetched successfully", data);
});

exports.setMaintenanceAmount = asyncHandler(async (req, res) => {
  const data = await financeService.setMaintenanceAmount(req);
  sendResponse(res, 200, true, "Maintenance amount updated", data);
});

exports.sendMaintenanceReminders = asyncHandler(async (req, res) => {
  const data = await financeService.sendMaintenanceReminders(req);
  sendResponse(
    res, 200, true,
    data.reminded ? `Reminded ${data.reminded} resident(s)` : "Nothing is outstanding",
    data
  );
});

exports.getMaintenanceHub = asyncHandler(async (req, res) => {
  const data = await financeService.getMaintenanceHub(req);
  sendResponse(res, 200, true, "Maintenance hub fetched successfully", data);
});

exports.listExpenses = asyncHandler(async (req, res) => {
  const data = await financeService.listExpenses(req);
  sendResponse(res, 200, true, "Expenses fetched successfully", data);
});

exports.createExpense = asyncHandler(async (req, res) => {
  const data = await financeService.createExpense(req);
  sendResponse(res, 201, true, "Expense added successfully", data);
});

exports.updateExpense = asyncHandler(async (req, res) => {
  const data = await financeService.updateExpense(req);
  sendResponse(res, 200, true, "Expense updated successfully", data);
});

exports.deleteExpense = asyncHandler(async (req, res) => {
  const data = await financeService.deleteExpense(req);
  sendResponse(res, 200, true, "Expense removed successfully", data);
});

exports.listCampaigns = asyncHandler(async (req, res) => {
  const data = await financeService.listCampaigns(req);
  sendResponse(res, 200, true, "Funds fetched successfully", data);
});

exports.createCampaign = asyncHandler(async (req, res) => {
  const data = await financeService.createCampaign(req);
  sendResponse(res, 201, true, "Fund created successfully", data);
});

exports.updateCampaign = asyncHandler(async (req, res) => {
  const data = await financeService.updateCampaign(req);
  sendResponse(res, 200, true, "Fund updated successfully", data);
});

exports.deleteCampaign = asyncHandler(async (req, res) => {
  const data = await financeService.deleteCampaign(req);
  sendResponse(res, 200, true, "Fund removed successfully", data);
});

exports.listFundContributions = asyncHandler(async (req, res) => {
  const data = await financeService.listFundContributions(req);
  sendResponse(res, 200, true, "Fund fetched successfully", data);
});

exports.createContribution = asyncHandler(async (req, res) => {
  const data = await financeService.createContribution(req);
  sendResponse(
    res, 201, true,
    "Recorded. The treasurer will confirm it shortly.",
    data
  );
});

exports.verifyContribution = asyncHandler(async (req, res) => {
  const data = await financeService.verifyContribution(req);
  sendResponse(
    res, 200, true,
    data.status === "approved" ? "Contribution verified" : "Contribution rejected",
    data
  );
});

exports.getContributionReceipt = asyncHandler(async (req, res) => {
  const data = await financeService.getContributionReceipt(req);
  sendResponse(res, 200, true, "Receipt fetched successfully", data);
});

exports.listContributors = asyncHandler(async (req, res) => {
  const data = await financeService.listContributors(req);
  sendResponse(res, 200, true, "Contributors fetched successfully", data);
});
