const { v4: uuidv4 } = require("uuid");

const guestPassRepository = require("../repository/guestPassRepository");

const { generateQR } = require("../utils/qrGenerator");
const { uploadBase64 } = require("../utils/cloudinaryUpload");

const AppError = require("../utils/appError");

// ======================================================
// Generate Guest Pass
// ======================================================

exports.generateGuestPass = async (req) => {
  const {
    guestName,
    guestPhone,
    guestPhoto,
    purpose,
    vehicleNumber,
    numberOfGuests,
    arrivalDate,
    expiryDate,
    passType,
    notes,
  } = req.body;

  // =============================================
  // Validate Pass Type
  // =============================================

  const allowedPassTypes = [
    "one_time",
    "multi_day",
    "permanent",
  ];

  if (!allowedPassTypes.includes(passType)) {
    throw new AppError("Invalid pass type.", 400);
  }

  // =============================================
  // Validate Arrival Date
  // =============================================

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const arrival = new Date(arrivalDate);
  arrival.setHours(0, 0, 0, 0);

  if (arrival < today) {
    throw new AppError(
      "Arrival date cannot be in the past.",
      400
    );
  }

  // =============================================
  // Validate Expiry Date
  // =============================================

  if (passType !== "permanent") {
    const expiry = new Date(expiryDate);

    if (expiry <= arrival) {
      throw new AppError(
        "Expiry date must be after arrival date.",
        400
      );
    }
  }

  // =============================================
  // Generate Secure Token
  // =============================================

  const qrToken = uuidv4();

  // =============================================
  // Create Guest Pass
  // =============================================

  const guestPass =
    await guestPassRepository.create({

      societyId: req.user.societyId,

      residentId: req.user.id,

      flatId: req.user.flatId,

      wingId: req.user.wingId,

      guestName,

      guestPhone,

      guestPhoto,

      purpose,

      vehicleNumber,

      numberOfGuests,

      arrivalDate,

      expiryDate:
        passType === "permanent"
          ? null
          : expiryDate,

      passType,

      qrToken,

      qrVersion: 1,

      notes,

      createdFrom: "resident",

      createdBy: req.user.id,

    });

  // =============================================
  // Prepare QR Payload
  // =============================================

  const payload = {

    version: 1,

    passId: guestPass._id,

    societyId: guestPass.societyId,

    token: qrToken,

    passType: guestPass.passType,

    generatedAt: new Date().toISOString(),

  };

  // =============================================
  // Generate QR
  // =============================================

  const qrBase64 =
    await generateQR(payload);

  // =============================================
  // Upload QR
  // =============================================

  const qrUrl =
    await uploadBase64(
      qrBase64,
      "guest-passes"
    );

  // =============================================
  // Save QR URL
  // =============================================

  const updatedGuestPass =
    await guestPassRepository.saveQrCode(
      guestPass._id,
      qrUrl
    );

  return updatedGuestPass;
};