const AppError = require("./appError");

// =======================================================
// VALIDATE
// Runs a Joi schema against a payload and returns the
// validated value. Throws AppError(400) on failure so
// services never have to branch on validation results.
// =======================================================

exports.validate = (schema, payload) => {

  if (!schema || typeof schema.validate !== "function") {

    throw new AppError(
      "Validation schema is missing or invalid.",
      500
    );

  }

  const { error, value } = schema.validate(
    payload,
    {
      abortEarly: false,
      stripUnknown: true,
    }
  );

  if (error) {

    const message = error.details
      .map((detail) => detail.message)
      .join(", ");

    throw new AppError(message, 400);

  }

  return value;

};
