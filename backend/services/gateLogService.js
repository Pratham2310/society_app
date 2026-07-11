const gateLogRepository = require("../repository/gateLogRepository");

const guestPassService = require("./guestPassService");

const {
  visitorEntryBodySchema,
  visitorExitBodySchema,
} = require("../validation/gateLogValidation");

const {
  validate,
} = require("../utils/validationHelper");

const {
  startTransaction,
  commitTransaction,
  abortTransaction,
} = require("../utils/transactionHelper");

const AppError = require("../utils/appError");


// =======================================================
// PRIVATE
// VALIDATE GUEST PASS
// =======================================================

const validateGuestPass = (
  guestPass
) => {

  if (!guestPass) {

    throw new AppError(
      "Guest pass not found.",
      404
    );

  }

  if (guestPass.status !== "active") {

    throw new AppError(
      "Guest pass is not active.",
      400
    );

  }

};

// =======================================================
// PRIVATE
// VALIDATE ENTRY
// =======================================================

const validateEntry = (
  latestLog
) => {

  if (
    latestLog &&
    latestLog.scanType === "entry"
  ) {

    throw new AppError(
      "Visitor has already entered.",
      400
    );

  }

};


// =======================================================
// PRIVATE
// VALIDATE EXIT
// =======================================================

const validateExit = (
  latestLog
) => {

  if (!latestLog) {

    throw new AppError(
      "Visitor has not entered yet.",
      400
    );

  }

  if (
    latestLog.scanType === "exit"
  ) {

    throw new AppError(
      "Visitor has already exited.",
      400
    );

  }

};


// =======================================================
// PRIVATE
// BUILD ENTRY LOG
// =======================================================

const buildEntryLog = (
  guestPass,
  guard
) => {

  return {

    societyId: guestPass.societyId,

    guestPassId: guestPass._id,

    residentId: guestPass.residentId,

    flatId: guestPass.flatId,

    guardId: guard.id,

    visitorType: "guest",

    visitorName: guestPass.guestName,

    visitorPhone: guestPass.guestPhone,

    vehicleNumber: guestPass.vehicleNumber,

    purpose: guestPass.purpose,

    verificationMethod: "qr",

    scanType: "entry",

    verifiedByQR: true,

    device: "Main Gate",

  };

};


// =======================================================
// PRIVATE
// BUILD EXIT LOG
// =======================================================

const buildExitLog = (
  guestPass,
  guard
) => {

  return {

    societyId: guestPass.societyId,

    guestPassId: guestPass._id,

    residentId: guestPass.residentId,

    flatId: guestPass.flatId,

    guardId: guard.id,

    visitorType: "guest",

    visitorName: guestPass.guestName,

    visitorPhone: guestPass.guestPhone,

    vehicleNumber: guestPass.vehicleNumber,

    purpose: guestPass.purpose,

    verificationMethod: "qr",

    scanType: "exit",

    verifiedByQR: true,

    device: "Main Gate",

  };

};







// =======================================================
// SCAN VISITOR ENTRY
// =======================================================

const scanVisitorEntry = async (

  guestPassId,

  guard

) => {

  // ==========================================
  // Validate Request
  // ==========================================

  validate(
    visitorEntryBodySchema,
    {
      guestPassId,
    }
  );

  // ==========================================
  // Load Guest Pass
  // ==========================================

  const guestPass =
    await guestPassService.getGuestPassById(
      guestPassId,
      guard
    );

  validateGuestPass(
    guestPass
  );

  // ==========================================
  // Check Latest Scan
  // ==========================================

  const latestLog =
    await gateLogRepository.findLatestScan(
      guestPassId
    );

  validateEntry(
    latestLog
  );

  // ==========================================
  // Build Entry Log
  // ==========================================

  const gateLogData =
    buildEntryLog(
      guestPass,
      guard
    );

  let session;

  try {

    // ==========================================
    // Start Transaction
    // ==========================================

    session =
      await startTransaction();

    // ==========================================
    // Create Gate Log
    // ==========================================

    const gateLog =
      await gateLogRepository.create(

        gateLogData,

        session

      );

    // ==========================================
    // Record Scan
    // ==========================================

    await guestPassService.recordGuestPassScan(

      guestPass._id,

      guestPass.societyId,

      session

    );

    // ==========================================
    // Commit
    // ==========================================

    await commitTransaction(
      session
    );

    return gateLog;

  }

  catch (error) {

    if (session) {

      await abortTransaction(
        session
      );

    }

    throw error;

  }

};



// =======================================================
// SCAN VISITOR EXIT
// =======================================================

const scanVisitorExit = async (

  guestPassId,

  guard

) => {

  // ==========================================
  // Validate Request
  // ==========================================

  validate(
    visitorExitBodySchema,
    {
      guestPassId,
    }
  );

  // ==========================================
  // Load Guest Pass
  // ==========================================

  const guestPass =
    await guestPassService.getGuestPassById(
      guestPassId,
      guard
    );

  validateGuestPass(
    guestPass
  );

  // ==========================================
  // Find Latest Scan
  // ==========================================

  const latestLog =
    await gateLogRepository.findLatestScan(
      guestPassId
    );

  validateExit(
    latestLog
  );

  // ==========================================
  // Build Exit Log
  // ==========================================

  const gateLogData =
    buildExitLog(
      guestPass,
      guard
    );

  let session;

  try {

    // ==========================================
    // Start Transaction
    // ==========================================

    session =
      await startTransaction();

    // ==========================================
    // Create Exit Log
    // ==========================================

    const gateLog =
      await gateLogRepository.create(

        gateLogData,

        session

      );

    // ==========================================
    // Record Scan
    // ==========================================

    await guestPassService.recordGuestPassScan(

      guestPass._id,

      guestPass.societyId,

      session

    );

    // ==========================================
    // Commit
    // ==========================================

    await commitTransaction(
      session
    );

    return gateLog;

  }

  catch (error) {

    if (session) {

      await abortTransaction(
        session
      );

    }

    throw error;

  }

};


// =======================================================
// GET GATE LOGS
// =======================================================

const getGateLogs = async (
  societyId,
  options = {}
) => {

  return gateLogRepository.findAll(
    { societyId },
    options
  );

};


// =======================================================
// GET GUEST VISIT HISTORY
// =======================================================

const getGuestVisitHistory = async (
  guestPassId
) => {

  return gateLogRepository.findByGuestPass(
    guestPassId
  );

};



// =======================================================
// GET TODAY'S GATE LOGS
// =======================================================

const getTodayGateLogs = async (
  societyId,
  startOfDay,
  endOfDay
) => {

  return gateLogRepository.findTodayLogs(
    societyId,
    startOfDay,
    endOfDay
  );

};



// =======================================================
// GET GATE LOG STATISTICS
// =======================================================

const getGateLogStatistics = async (
  societyId
) => {

  const [

    totalLogs,

    totalEntries,

    totalExits,

  ] = await Promise.all([

    gateLogRepository.countLogs(
      societyId
    ),

    gateLogRepository.countByScanType(
      societyId,
      "entry"
    ),

    gateLogRepository.countByScanType(
      societyId,
      "exit"
    ),

  ]);

  return {

    totalLogs,

    totalEntries,

    totalExits,

  };

};


module.exports = {

  scanVisitorEntry,

  scanVisitorExit,

  getGateLogs,

  getGuestVisitHistory,

  getTodayGateLogs,

  getGateLogStatistics,

};