const cloudinary = require("../config/cloudinary");

// =======================================================
// UPLOAD BASE64
// Returns the full result so callers can persist both the
// URL and the public_id needed for later deletion.
// =======================================================

exports.uploadBase64 = async (base64, folder) => {

  const result = await cloudinary.uploader.upload(
    base64,
    { folder }
  );

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };

};


// =======================================================
// DELETE FILE
// =======================================================

exports.deleteFile = async (publicId) => {

  if (!publicId) {

    return;

  }

  return cloudinary.uploader.destroy(publicId);

};
