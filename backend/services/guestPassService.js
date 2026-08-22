const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const guestPassRepository = require("../repository/guestPassRepository");

const qrService = require("./qrService");

const {

  createGuestPassBodySchema,

} = require("../validation/guestPassValidation");

const {

  validate,

} = require("../utils/validationHelper");

const AppError = require("../utils/appError");


// =======================================================
// PRIVATE
// BUSINESS VALIDATION
// =======================================================

const validateBusinessRules = (

  body,

  user

) => {

  const arrivalDate = new Date(

    body.arrivalDate

  );

  if (

    body.passType !== "permanent"

  ) {

    if (!body.expiryDate) {

      throw new AppError(

        "Expiry date is required.",

        400

      );

    }

    const expiryDate = new Date(

      body.expiryDate

    );

    if (

      expiryDate <= arrivalDate

    ) {

      throw new AppError(

        "Expiry date must be after arrival date.",

        400

      );

    }

  }

  if (

    !user.societyId ||

    !user.flatId ||

    !user.wingId

  ) {

    throw new AppError(

      "Resident profile is incomplete.",

      400

    );

  }

};



// =======================================================
// PRIVATE
// GET VALIDATED GUEST PASS
// =======================================================

const getValidatedGuestPass = async (
  guestPassId,
  societyId
) => {

  const guestPass =
    await guestPassRepository.findGuestPassById(
      guestPassId,
      societyId
    );

  if (!guestPass) {

    throw new AppError(
      "Guest pass not found.",
      404
    );

  }

  return guestPass;

};


// =======================================================
// PRIVATE
// VALIDATE MODIFIABLE PASS
// =======================================================

const validateModifiableGuestPass = (
  guestPass
) => {

  if (guestPass.status !== "active") {

    throw new AppError(
      "Only active guest passes can be modified.",
      400
    );

  }

};


// =======================================================
// PRIVATE
// VALIDATE APPROVAL
// =======================================================

const validateApproval = (
  guestPass
) => {

  if (guestPass.approvedAt) {

    throw new AppError(
      "Guest pass is already approved.",
      400
    );

  }

};

// =======================================================
// PRIVATE
// BUILD GUEST PASS DATA
// =======================================================

const buildGuestPassData = (

  body,

  user

) => {

  return {

    societyId: user.societyId,

    residentId: user.id,

    flatId: user.flatId,

    wingId: user.wingId,

    guestName: body.guestName,

    guestPhone: body.guestPhone,

    guestPhoto: body.guestPhoto,

    purpose: body.purpose,

    vehicleNumber: body.vehicleNumber,

    numberOfGuests: body.numberOfGuests,

    arrivalDate: body.arrivalDate,

    expiryDate:

      body.passType === "permanent"

        ? null

        : body.expiryDate,

    passType: body.passType,

    createdSource: "resident",

    notes: body.notes,

    createdBy: user.id,

  };

};



// =======================================================
// PRIVATE
// START TRANSACTION
// =======================================================

const startTransaction = async () => {

  const session =

    await mongoose.startSession();

  session.startTransaction();

  return session;

};

// =======================================================
// PRIVATE
// COMMIT TRANSACTION
// =======================================================

const commitTransaction = async (

  session

) => {

  await session.commitTransaction();

  session.endSession();

};

// =======================================================
// PRIVATE
// ABORT TRANSACTION
// =======================================================

const abortTransaction = async (

  session

) => {

  await session.abortTransaction();

  session.endSession();

};


// =======================================================
// PRIVATE
// BUILD QR PAYLOAD
// The data encoded into the QR image and read by a guard's
// scanner. Deliberately minimal: identifiers the gate can verify
// against the database, never visitor personal details, because
// a QR code is effectively public once it is on someone's phone.
// =======================================================

const buildQrPayload = (guestPass, qrToken) => {

  return {

    guestPassId: String(guestPass._id),

    societyId: String(guestPass.societyId),

    qrToken,

    passType: guestPass.passType,

    arrivalDate: guestPass.arrivalDate,

    expiryDate: guestPass.expiryDate,

  };

};


// =======================================================
// PRIVATE
// CREATE GUEST PASS INTERNAL
// =======================================================

const createGuestPassInternal = async (

  guestPassData,

  session = null

) => {

  const guestPass =
    await guestPassRepository.create(

      guestPassData,

      session

    );

  const qrPayload =
    buildQrPayload(

      guestPass,

      guestPass.qrToken

    );

  const qrResult =
    await qrService.createQRCode(

      qrPayload,

      {

        folder: "guest-passes",

      }

    );

  return guestPassRepository.saveInitialQRCode(

    guestPass._id,

    guestPass.societyId,

    qrResult.qrToken,

    qrResult.qrCode,

    qrResult.qrPublicId,

    session

  );

};


// =======================================================
// CREATE GUEST PASS
// =======================================================

const createGuestPass = async (

  body,

  user

) => {

  // ==========================================
  // Validate Request
  // ==========================================

  const validatedBody = validate(

    createGuestPassBodySchema,

    body

  );

  // ==========================================
  // Business Validation
  // ==========================================

  validateBusinessRules(

    validatedBody,

    user

  );

  let session;

  let qrResponse = null;

  try {

    // ==========================================
    // Start Transaction
    // ==========================================

    session = await startTransaction();

    // ==========================================
    // Build Guest Pass
    // ==========================================

    const guestPassData = buildGuestPassData(

      validatedBody,

      user

    );

    // ==========================================
    // Create Guest Pass
    // ==========================================

    const guestPass =

      await guestPassRepository.create(

        guestPassData,

        session

      );

    // ==========================================
    // Generate QR
    // ==========================================

    qrResponse =

      await qrService.createQRCode(

        {

          guestPassId: guestPass._id,

          societyId: guestPass.societyId,

          residentId: guestPass.residentId,

          passType: guestPass.passType,

          arrivalDate: guestPass.arrivalDate,

          expiryDate: guestPass.expiryDate,

        },

        {

          folder: "guest-passes",

          qrVersion: 1,

        }

      );

    // ==========================================
    // Save QR
    // ==========================================

    const updatedGuestPass =

      await guestPassRepository.saveInitialQRCode(

        guestPass._id,

        guestPass.societyId,

        {

          qrToken: qrResponse.qrToken,

          qrCode: qrResponse.qrCode,

          qrPublicId: qrResponse.qrPublicId,

          qrVersion: qrResponse.qrVersion,

        },

        session

      );

    // ==========================================
    // Commit
    // ==========================================

    await commitTransaction(

      session

    );

    return updatedGuestPass;

  }

  catch (error) {

    // ==========================================
    // Cleanup Uploaded QR
    // ==========================================

    if (

      qrResponse?.qrPublicId

    ) {

      await qrService.removeQRCode(

        qrResponse.qrPublicId

      );

    }

    // ==========================================
    // Rollback
    // ==========================================

    if (session) {

      await abortTransaction(

        session

      );

    }

    throw error;

  };

};


// =======================================================
// GET GUEST PASS
// =======================================================

const getGuestPassById = async (
  guestPassId,
  user
) => {

  const guestPass =
    await guestPassRepository.findGuestPassById(
      guestPassId,
      user.societyId
    );

  if (!guestPass) {

    throw new AppError(
      "Guest pass not found.",
      404
    );

  }

  return guestPass;

};

// =======================================================
// GET RESIDENT PASSES
// =======================================================

const getResidentGuestPasses = async (
  residentId,
  user,
  options = {}
) => {

  return guestPassRepository.findResidentPasses(
    residentId,
    user.societyId,
    options
  );

};

// =======================================================
// GET SOCIETY PASSES
// =======================================================

const getSocietyGuestPasses = async (
  user,
  options = {}
) => {

  return guestPassRepository.findSocietyPasses(
    user.societyId,
    options
  );

};


// =======================================================
// APPROVE GUEST PASS
// =======================================================

const approveGuestPass = async (
  guestPassId,
  user
) => {

  const guestPass =
    await getValidatedGuestPass(
      guestPassId,
      user.societyId
    );

  validateApproval(
    guestPass
  );

  return guestPassRepository.approvePass(
    guestPassId,
    user.societyId,
    user.id
  );

};


// =======================================================
// CANCEL GUEST PASS
// =======================================================

const cancelGuestPass = async (
  guestPassId,
  reason,
  user
) => {

  const guestPass =
    await getValidatedGuestPass(
      guestPassId,
      user.societyId
    );

  validateModifiableGuestPass(
    guestPass
  );

  return guestPassRepository.updatePassStatus(
    guestPassId,
    user.societyId,
    guestPass.status,
    "cancelled",
    reason,
    user.id
  );

}; 



// =======================================================
// ARCHIVE GUEST PASS
// =======================================================

const archiveGuestPass = async (
  guestPassId,
  user
) => {

  const guestPass =
    await getValidatedGuestPass(
      guestPassId,
      user.societyId
    );

  return guestPassRepository.archiveGuestPass(
    guestPassId,
    user.societyId,
    guestPass.status,
    user.id
  );

};



// =======================================================
// EXTEND GUEST PASS
// =======================================================

const extendGuestPass = async (
  guestPassId,
  expiryDate,
  reason,
  user
) => {

  const guestPass =
    await getValidatedGuestPass(
      guestPassId,
      user.societyId
    );

  validateModifiableGuestPass(
    guestPass
  );

  const history = {

    previousExpiry:
      guestPass.expiryDate,

    newExpiry: expiryDate,

    extendedBy: user.id,

    reason,

  };

  return guestPassRepository.extendPass(
    guestPassId,
    user.societyId,
    expiryDate,
    history
  );

};


// =======================================================
// REGENERATE GUEST PASS QR
// =======================================================

const regenerateGuestPassQRCode = async (
  guestPassId,
  user
) => {

  const guestPass =
    await getValidatedGuestPass(
      guestPassId,
      user.societyId
    );

  validateModifiableGuestPass(
    guestPass
  );

  let session;

  let qrResponse = null;

  try {

    session = await startTransaction();

    qrResponse =
      await qrService.regenerateQRCode(
        {
          guestPassId: guestPass._id,
          societyId: guestPass.societyId,
          residentId: guestPass.residentId,
          passType: guestPass.passType,
          arrivalDate: guestPass.arrivalDate,
          expiryDate: guestPass.expiryDate,
        },
        {
          qrPublicId: guestPass.qrPublicId,
          qrVersion: guestPass.qrVersion,
        },
        {
          folder: "guest-passes",
        }
      );

    const updatedGuestPass =
      await guestPassRepository.regenerateQRCode(
        guestPassId,
        user.societyId,
        qrResponse.qrToken,
        qrResponse.qrCode,
        qrResponse.qrPublicId,
        session
      );

    await commitTransaction(session);

    // Delete old QR only after successful commit
    if (guestPass.qrPublicId) {
      await qrService.removeQRCode(
        guestPass.qrPublicId
      );
    }

    return updatedGuestPass;

  }

  catch (error) {

    if (qrResponse?.qrPublicId) {

      await qrService.removeQRCode(
        qrResponse.qrPublicId
      );

    }

    if (session) {

      await abortTransaction(
        session
      );

    }

    throw error;

  }

};



// =======================================================
// GUEST PASS STATISTICS
// =======================================================

const getGuestPassStatistics = async (
  user
) => {

  const societyId = user.societyId;

  const [

    total,

    active,

    expired,

    permanent,

  ] = await Promise.all([

    guestPassRepository.countTotalPasses(
      societyId
    ),

    guestPassRepository.countPassesByStatus(
      societyId,
      "active"
    ),

    guestPassRepository.countPassesByStatus(
      societyId,
      "expired"
    ),

    guestPassRepository.countPassesByType(
      societyId,
      "permanent"
    ),

  ]);



  return {

    total,

    active,

    expired,

    permanent,

  };

};

// =======================================================
// CREATE GUEST PASS FROM APPROVAL
// =======================================================

const createGuestPassFromApproval = async (

  approval,

  resident,

  session = null

) => {

  const qrToken =
    uuidv4();

  const guestPassData = {

    societyId: approval.societyId,

    residentId: approval.residentId,

    flatId: approval.flatId,

    wingId: approval.wingId,

    guestName: approval.visitorName,

    guestPhone: approval.visitorPhone,

    guestPhoto: approval.visitorPhoto,

    purpose: approval.purpose,

    vehicleNumber: approval.vehicleNumber,

    numberOfGuests:
      approval.numberOfVisitors,

    arrivalDate:
      new Date(),

    expiryDate:
      approval.expiresAt,

    passType:
      "one_time",

    qrToken,

    qrVersion: 1,

    createdSource:
      "visitor_approval",

    createdBy:
      resident.id,

  };

  return createGuestPassInternal(

    guestPassData,

    session

  );

};


// =======================================================
// RECORD GUEST PASS SCAN
// =======================================================

const recordGuestPassScan = async (
  guestPassId,
  societyId,
  session = null
) => {

  return guestPassRepository.updateLastScanned(
    guestPassId,
    societyId,
    session
  );

};

module.exports = {

  createGuestPass,

  getGuestPassById,

  getResidentGuestPasses,

  getSocietyGuestPasses,

  approveGuestPass,

  cancelGuestPass,

  extendGuestPass,

  archiveGuestPass,

  regenerateGuestPassQRCode,

  getGuestPassStatistics,

  recordGuestPassScan,

  createGuestPassFromApproval,

};