const AppError = require("../utils/appError");

module.exports = (err, req, res, next) => {

  console.error(err);

  // Mongo duplicate key
  if (err.code === 11000) {

    const field = Object.keys(err.keyValue)[0];

    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });

  }

  // Joi validation
  if (err.isJoi) {

    return res.status(400).json({
      success: false,
      message: err.details[0].message
    });

  }

  const statusCode =
    err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      err.message || "Internal Server Error"
  });

};