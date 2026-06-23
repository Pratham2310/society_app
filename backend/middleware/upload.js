const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const CloudinaryStorage = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,

  folder: "society-app",

  allowedFormats: [
    "jpg",
    "jpeg",
    "png",
    "pdf"
  ]
});

const upload = multer({
  storage
});

module.exports = upload;