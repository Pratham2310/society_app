const visitorApprovalService = require("../services/visitorApprovalService");

const catchAsync = require("../utils/asyncHandler");

const { sendResponse } = require("../utils/responseHelper");


// The route already names the approval in its path. Reading it from
// there rather than the body means a client cannot address one
// request in the URL and a different one in the payload.
const withApprovalId = (req) => ({
  ...req.body,
  approvalId: req.params.approvalId,
});



// =======================================================
// REQUEST APPROVAL
// =======================================================

exports.requestApproval = catchAsync(

  async (req, res) => {

    const body = req.body;

    const guard = req.user;

    const approval =
      await visitorApprovalService.requestApproval(
        body,
        guard
      );

    sendResponse(

      res,

      201,

      true,

      "Approval request created successfully.",

      approval

    );

  }

);



// =======================================================
// APPROVE REQUEST
// =======================================================

exports.approveRequest = catchAsync(

  async (req, res) => {

    const body = withApprovalId(req);

    const resident = req.user;

    const approval =
      await visitorApprovalService.approveRequest(
        body,
        resident
      );

    sendResponse(

      res,

      200,

      true,

      "Visitor approved successfully.",

      approval

    );

  }

);



// =======================================================
// REJECT REQUEST
// =======================================================

exports.rejectRequest = catchAsync(

  async (req, res) => {

    const body = withApprovalId(req);

    const resident = req.user;

    const approval =
      await visitorApprovalService.rejectRequest(
        body,
        resident
      );

    sendResponse(

      res,

      200,

      true,

      "Visitor request rejected successfully.",

      approval

    );

  }

);


// =======================================================
// CANCEL REQUEST
// =======================================================

exports.cancelRequest = catchAsync(

  async (req, res) => {

    const body = withApprovalId(req);

    const guard = req.user;

    const approval =
      await visitorApprovalService.cancelRequest(
        body,
        guard
      );

    sendResponse(

      res,

      200,

      true,

      "Approval request cancelled successfully.",

      approval

    );

  }

);



// =======================================================
// GET APPROVAL BY ID
// =======================================================

exports.getApprovalById = catchAsync(

  async (req, res) => {

    const { approvalId } = req.params;

    const user = req.user;

    const approval =
      await visitorApprovalService.getApprovalById(
        approvalId,
        user
      );

    sendResponse(

      res,

      200,

      true,

      "Approval request fetched successfully.",

      approval

    );

  }

);



// =======================================================
// GET RESIDENT PENDING REQUESTS
// =======================================================

exports.getResidentPendingRequests = catchAsync(

  async (req, res) => {

    const resident = req.user;

    const options = req.query;

    const approvals =
      await visitorApprovalService.getResidentPendingRequests(
        resident,
        options
      );

    sendResponse(

      res,

      200,

      true,

      "Pending approval requests fetched successfully.",

      approvals

    );

  }

);



// =======================================================
// GET GUARD PENDING REQUESTS
// =======================================================

exports.getGuardPendingRequests = catchAsync(

  async (req, res) => {

    const guard = req.user;

    const options = req.query;

    const approvals =
      await visitorApprovalService.getGuardPendingRequests(
        guard,
        options
      );

    sendResponse(

      res,

      200,

      true,

      "Pending approval requests fetched successfully.",

      approvals

    );

  }

);



// =======================================================
// GET APPROVAL STATISTICS
// =======================================================

exports.getApprovalStatistics = catchAsync(

  async (req, res) => {

    const user = req.user;

    const statistics =
      await visitorApprovalService.getApprovalStatistics(
        user.societyId
      );

    sendResponse(

      res,

      200,

      true,

      "Approval statistics fetched successfully.",

      statistics

    );

  }

);