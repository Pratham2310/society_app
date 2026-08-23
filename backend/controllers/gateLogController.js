const gateLogService = require("../services/gateLogService");
const catchAsync = require("../utils/asyncHandler");
const { sendResponse } = require("../utils/responseHelper");


// =======================================================
// SCAN VISITOR ENTRY
// =======================================================

exports.scanVisitorEntry = catchAsync(

  async (req, res) => {

    const { guestPassId } = req.body;

    const guard = req.user;

    const gateLog =
      await gateLogService.scanVisitorEntry(
        guestPassId,
        guard
      );

    sendResponse(

      res,

      201,

      true,

      "Visitor entry recorded successfully.",

      gateLog

    );

  }

);


// =======================================================
// SCAN VISITOR EXIT
// =======================================================

exports.scanVisitorExit = catchAsync(

  async (req, res) => {

    const { guestPassId } = req.body;

    const guard = req.user;

    const gateLog =
      await gateLogService.scanVisitorExit(
        guestPassId,
        guard
      );

    sendResponse(

      res,

      200,

      true,

      "Visitor exit recorded successfully.",

      gateLog

    );

  }

);



// =======================================================
// GET GATE LOGS
// =======================================================

exports.getGateLogs = catchAsync(

  async (req, res) => {

    const user = req.user;

    const options = req.query;

    const gateLogs =
      await gateLogService.getGateLogs(
        user.societyId,
        options
      );

    sendResponse(

      res,

      200,

      true,

      "Gate logs fetched successfully.",

      gateLogs

    );

  }

);



// =======================================================
// GET GUEST VISIT HISTORY
// =======================================================

exports.getGuestVisitHistory = catchAsync(

  async (req, res) => {

    const { guestPassId } = req.params;

    const history =
      await gateLogService.getGuestVisitHistory(
        guestPassId
      );

    sendResponse(

      res,

      200,

      true,

      "Guest visit history fetched successfully.",

      history

    );

  }

);



// =======================================================
// GET TODAY'S GATE LOGS
// =======================================================

exports.getTodayGateLogs = catchAsync(

  async (req, res) => {

    const { startOfDay, endOfDay } = req.query;

    const user = req.user;

    const gateLogs =
      await gateLogService.getTodayGateLogs(

        user.societyId,

        startOfDay,

        endOfDay

      );

    sendResponse(

      res,

      200,

      true,

      "Today's gate logs fetched successfully.",

      gateLogs

    );

  }

);



// =======================================================
// GET GATE LOG STATISTICS
// =======================================================

exports.getGateLogStatistics = catchAsync(

  async (req, res) => {

    const user = req.user;

    const statistics =
      await gateLogService.getGateLogStatistics(
        user.societyId
      );

    sendResponse(

      res,

      200,

      true,

      "Gate log statistics fetched successfully.",

      statistics

    );

  }

);