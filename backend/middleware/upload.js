const multer = require("multer");

const cloudinary = require("../config/cloudinary");
const AppError = require("../utils/appError");

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

// =======================================================
// CLOUDINARY STORAGE ENGINE
// Written directly against the cloudinary SDK because
// multer-storage-cloudinary@4 peer-depends on cloudinary v1
// and this project is on v2. A storage engine is only two
// methods, and doing it here also lets the destination folder
// depend on the authenticated caller.
// =======================================================

class CloudinaryStorage {

  _handleFile(req, file, cb) {

    // Scope every upload to the caller's society so one tenant's
    // files can never land in another's namespace.
    const societyId = req.user?.societyId
      ? String(req.user.societyId)
      : "unscoped";

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `society-app/${societyId}`,
        resource_type: file.mimetype === "application/pdf" ? "raw" : "image",
        allowed_formats: [...new Set(ALLOWED.values())],
      },
      (error, result) => {

        if (error) {
          return cb(error);
        }

        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          size: result.bytes,
        });

      }
    );

    file.stream.pipe(stream);

  }

  _removeFile(req, file, cb) {

    if (!file.filename) {
      return cb(null);
    }

    cloudinary.uploader.destroy(file.filename)
      .then(() => cb(null))
      .catch(cb);

  }

}

const fileFilter = (req, file, cb) => {

  if (!ALLOWED.has(file.mimetype)) {

    return cb(
      new AppError(
        `Unsupported file type. Allowed: ${[...ALLOWED.keys()].join(", ")}`,
        400
      )
    );

  }

  cb(null, true);

};

const upload = multer({

  storage: new CloudinaryStorage(),

  fileFilter,

  limits: {
    fileSize: MAX_FILE_BYTES,
    files: 1,
  },

});

module.exports = upload;
module.exports.MAX_FILE_BYTES = MAX_FILE_BYTES;
