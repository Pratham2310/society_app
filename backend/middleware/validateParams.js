const AppError = require("../utils/appError");

// =======================================================
// PARAM VALIDATION
//
// req.params reaches services unchecked in most of this codebase,
// which is how an invalid ObjectId becomes a 500 instead of a 400.
// =======================================================

module.exports = (schema) => {

  return (req, res, next) => {

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }

    req.params = { ...req.params, ...value };

    return next();

  };

};
