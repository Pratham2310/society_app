const logger = require("../utils/logger");
const sentry = require("../config/sentry");

module.exports = (err, req, res, next) => {

  const statusCodeForLog = err.statusCode || 500;

  //A 404 or 403 is the API working correctly; only a 5xx is a defect.
  //Logging expected errors at error level trains people to ignore the
  //channel that matters.
  const log = req.log || logger;

  if (statusCodeForLog >= 500) {

    log.error(
      { err, statusCode: statusCodeForLog, route: `${req.method} ${req.originalUrl}` },
      err.message
    );

    sentry.captureException(err, {
      requestId: req.id,
      userId: req.user?.id,
      societyId: req.user?.societyId,
      route: `${req.method} ${req.originalUrl}`,
    });

  } else {

    log.warn(
      { statusCode: statusCodeForLog, route: `${req.method} ${req.originalUrl}` },
      err.message
    );

  }

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