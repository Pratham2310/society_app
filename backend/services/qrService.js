const logger = require("../utils/logger");
const { v4: uuidv4 } = require("uuid");

const {
  generateQR,
} = require("../utils/qrGenerator");

const {
  uploadBase64,
  deleteFile,
} = require("../utils/cludinaryUploads");

const AppError = require("../utils/appError");

// =======================================================
// PRIVATE
// BUILD QR PAYLOAD
// =======================================================

const buildPayload = (data) => {

  return {

    ...data,

    generatedAt: new Date().toISOString(),

  };

};

// =======================================================
// PRIVATE
// GENERATE QR IMAGE
// =======================================================

const generateQRCodeImage = async (
  payload
) => {

  try {

    return await generateQR(payload);

  }

  catch {

    throw new AppError(

      "Unable to generate QR code.",

      500

    );

  }

};

// =======================================================
// PRIVATE
// UPLOAD QR IMAGE
// =======================================================

const uploadQRCode = async (

  qrBase64,

  folder

) => {

  try {

    return await uploadBase64(

      qrBase64,

      folder

    );

  }

  catch {

    throw new AppError(

      "Unable to upload QR code.",

      500

    );

  }

};

// =======================================================
// PRIVATE
// DELETE QR IMAGE
// =======================================================

const deleteQRCode = async (
  qrPublicId
) => {

  if (!qrPublicId) {

    return;

  }

  try {

    await deleteFile(qrPublicId);

  }

  catch (error) {

    logger.error({ err: error }, "QR cleanup failed");

  }

};

// =======================================================
// PRIVATE
// BUILD QR RESPONSE
// =======================================================

const buildQRResponse = (

  qrToken,

  qrCode,

  qrPublicId,

  qrVersion

) => {

  return {

    qrToken,

    qrCode,

    qrPublicId,

    qrVersion,

    generatedAt: new Date(),

  };

};


// =======================================================
// CREATE QR
// =======================================================

const createQRCode = async (
  payload,
  {
    folder = "guest-passes",
    qrVersion = 1,
  } = {}
) => {

  const qrToken = uuidv4();

  const finalPayload = buildPayload({

    ...payload,

    qrToken,

    qrVersion,

  });

  const qrBase64 =
    await generateQRCodeImage(finalPayload);

  const uploadResult =
    await uploadQRCode(
      qrBase64,
      folder
    );

  const qrResponse = buildQRResponse(

  qrToken,

  uploadResult.secure_url,

  uploadResult.public_id,

  qrVersion

);

return validateQRResponse(
  qrResponse
);

};

// =======================================================
// REGENERATE QR
// =======================================================

const regenerateQRCode = async (
  payload,
  currentQR,
  {
    folder = "guest-passes",
  } = {}
) => {

  if (
    currentQR &&
    currentQR.qrPublicId
  ) {

    await deleteQRCode(
      currentQR.qrPublicId
    );

  }

  return createQRCode(

    payload,

    {

      folder,

      qrVersion: getNextQRVersion(
        currentQR?.qrVersion
    ),

    }

  );

};

// =======================================================
// DELETE QR
// =======================================================

const removeQRCode = async (
  qrPublicId
) => {

  await deleteQRCode(
    qrPublicId
  );

};


// =======================================================
// GET QR VERSION
// =======================================================

const getNextQRVersion = (
  currentVersion = 0
) => {

  return currentVersion + 1;

};

// =======================================================
// VALIDATE QR RESPONSE
// =======================================================

const validateQRResponse = (
  qrResponse
) => {

  if (
    !qrResponse ||
    !qrResponse.qrToken ||
    !qrResponse.qrCode ||
    !qrResponse.qrPublicId
  ) {

    throw new AppError(
      "QR generation failed.",
      500
    );

  }

  return qrResponse;

};

module.exports={
    createQRCode,
    regenerateQRCode,
    removeQRCode,
    getNextQRVersion,
    validateQRResponse
};