const { v4: uuidv4 } = require("uuid");

const guestPassRepository = require("../repository/guestPassRepository");

const {
  createGuestPassBodySchema,
} = require("../validation/guestPassValidation");

const {
  validate,
} = require("../utils/validationHelper");

const {
  generateQR,
} = require("../utils/qrGenerator");

const {
  uploadBase64,
} = require("../utils/cloudinaryUpload");

const AppError = require("../utils/appError");


// =======================================================
// PRIVATE
// Validate Business Rules
// =======================================================

const validateBusinessRules = (body) => {

  const arrivalDate = new Date(body.arrivalDate);

  if (body.passType === "permanent") {
    return;
  }

  const expiryDate = new Date(body.expiryDate);

  if (expiryDate <= arrivalDate) {
    throw new AppError(
      "Expiry date must be after arrival date.",
      400
    );
  }

};


// =======================================================
// PRIVATE
// Build Guest Pass Data
// =======================================================

const buildGuestPassData = (
  body,
  user,
  qrToken
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

    qrToken,

    qrVersion: 1,

    createdSource: "resident",

    notes: body.notes,

    createdBy: user.id,

  };

};



// =======================================================
// PRIVATE
// Build QR Payload
// =======================================================

const buildQrPayload = (
  guestPass,
  qrToken
) => {

  return {

    version: 1,

    passId: guestPass._id,

    societyId: guestPass.societyId,

    token: qrToken,

    passType: guestPass.passType,

    generatedAt:
      new Date().toISOString(),

  };

};



// =======================================================
// PRIVATE
// Generate And Upload QR
// =======================================================

const generateAndUploadQr =
  async (payload) => {

    const qrBase64 =
      await generateQR(payload);

    return uploadBase64(
      qrBase64,
      "guest-passes"
    );

  };



  // =======================================================
// CREATE GUEST PASS
// =======================================================

const createGuestPass = async (req) => {

  // ==========================================
  // Validate Request Body
  // ==========================================

  const body = validate(
    createGuestPassBodySchema,
    req.body
  );

  // ==========================================
  // Business Validation
  // ==========================================

  validateBusinessRules(body);

  // ==========================================
  // Generate Secure QR Token
  // ==========================================

  const qrToken = uuidv4();

  // ==========================================
  // Prepare Guest Pass Data
  // ==========================================

  const guestPassData = buildGuestPassData(
    body,
    req.user,
    qrToken
  );

  // ==========================================
  // Save Guest Pass
  // ==========================================

  const guestPass =
    await guestPassRepository.create(
      guestPassData
    );

  // ==========================================
  // Build QR Payload
  // ==========================================

  const qrPayload = buildQrPayload(
    guestPass,
    qrToken
  );

  // ==========================================
  // Generate & Upload QR
  // ==========================================

  const qrCode = await generateAndUploadQr(
    qrPayload
  );

  // ==========================================
  // Save QR Code URL
  // ==========================================

  const updatedGuestPass =
    await guestPassRepository.saveQrCode(
      guestPass._id,
      qrCode
    );

  // ==========================================
  // Return Latest Guest Pass
  // ==========================================

  return updatedGuestPass;

};


module.exports={createGuestPass};