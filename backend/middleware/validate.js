const AppError = require("../utils/appError");

// =======================================================
// BODY VALIDATION
//
// Joi coerces and trims as it validates, but the coerced value was
// being thrown away and req.body left untouched — so a schema that
// said .trim() validated a trimmed string and then handed the
// untrimmed one to the service.
//
// The validated value is now written back, which is what makes
// normalisation in a schema actually mean anything.
// =======================================================

module.exports = (schema) => {

   return (req, res, next) => {

      const { error, value } = schema.validate(req.body);

      if (error) {
         return next(new AppError(error.details[0].message, 400));
      }

      req.body = value;

      return next();

   };

};
