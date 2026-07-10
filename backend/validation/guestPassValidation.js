const Joi = require("joi");

// =======================================================
// COMMON VALIDATORS
// =======================================================

// ----------------------
// Mongo ObjectId
// ----------------------
const objectId = Joi.string()
  .trim()
  .length(24)
  .hex()
  .required()
  .messages({
    "string.base": "Invalid ID.",
    "string.empty": "ID is required.",
    "string.length": "Invalid ID format.",
    "string.hex": "Invalid ID format.",
    "any.required": "ID is required.",
  });

// ----------------------
// Guest Name
// ----------------------
const guestName = Joi.string()
  .trim()
  .pattern(/^[A-Za-z ]+$/)
  .min(2)
  .max(100)
  .required()
  .messages({
    "string.empty": "Guest name is required.",
    "string.min": "Guest name must contain at least 2 characters.",
    "string.max": "Guest name cannot exceed 100 characters.",
    "string.pattern.base":
      "Guest name can contain only letters and spaces.",
    "any.required": "Guest name is required.",
  });

// ----------------------
// Guest Phone
// ----------------------
const guestPhone = Joi.string()
  .trim()
  .pattern(/^[0-9]{10}$/)
  .required()
  .messages({
    "string.empty": "Guest phone number is required.",
    "string.pattern.base":
      "Guest phone number must contain exactly 10 digits.",
    "any.required": "Guest phone number is required.",
  });

// ----------------------
// Guest Photo
// ----------------------
const guestPhoto = Joi.alternatives()
  .try(
    Joi.string().uri(),
    Joi.valid("", null)
  )
  .messages({
    "string.uri": "Guest photo must be a valid URL.",
  });

// ----------------------
// Purpose
// ----------------------
const purpose = Joi.string()
  .valid(
    "family",
    "friend",
    "delivery",
    "maintenance",
    "business",
    "other"
  )
  .required()
  .messages({
    "any.only": "Invalid purpose selected.",
    "any.required": "Purpose is required.",
  });

// ----------------------
// Vehicle Number
// ----------------------
const vehicleNumber = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z0-9 -]*$/)
  .max(20)
  .allow("", null)
  .messages({
    "string.pattern.base":
      "Invalid vehicle number.",
    "string.max":
      "Vehicle number cannot exceed 20 characters.",
  });

// ----------------------
// Number Of Guests
// ----------------------
const numberOfGuests = Joi.number()
  .integer()
  .min(1)
  .max(20)
  .default(1)
  .messages({
    "number.base":
      "Number of guests must be a number.",
    "number.min":
      "At least one guest is required.",
    "number.max":
      "Maximum 20 guests are allowed.",
  });

// ----------------------
// Arrival Date
// ----------------------
const arrivalDate = Joi.date()
  .required()
  .messages({
    "date.base": "Arrival date is invalid.",
    "any.required": "Arrival date is required.",
  });

// ----------------------
// Expiry Date
// ----------------------
const expiryDate = Joi.date()
  .allow(null)
  .messages({
    "date.base": "Expiry date is invalid.",
  });

// ----------------------
// Pass Type
// ----------------------
const passType = Joi.string()
  .valid(
    "one_time",
    "multi_day",
    "permanent"
  )
  .required()
  .messages({
    "any.only": "Invalid pass type.",
    "any.required": "Pass type is required.",
  });

// ----------------------
// Notes
// ----------------------
const notes = Joi.string()
  .trim()
  .max(500)
  .allow("", null)
  .messages({
    "string.max":
      "Notes cannot exceed 500 characters.",
  });

// ----------------------
// Reason
// ----------------------
const reason = Joi.string()
  .trim()
  .min(5)
  .max(300)
  .required()
  .messages({
    "string.empty": "Reason is required.",
    "string.min":
      "Reason must contain at least 5 characters.",
    "string.max":
      "Reason cannot exceed 300 characters.",
    "any.required": "Reason is required.",
  });

// ----------------------
// QR Token
// ----------------------
const qrToken = Joi.string()
  .trim()
  .messages({
    "string.base": "Invalid QR token.",
  });

// =======================================================
// CREATE GUEST PASS
// =======================================================

const createGuestPassSchema = Joi.object({

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

}).options({

  abortEarly: false,

  allowUnknown: false,

});



// =======================================================
// EXTEND GUEST PASS
// =======================================================

const extendGuestPassSchema = Joi.object({

  expiryDate,

  reason,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// CANCEL GUEST PASS
// =======================================================

const cancelGuestPassSchema = Joi.object({

  reason,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// UPDATE NOTES
// =======================================================

const updateNotesSchema = Joi.object({

  notes,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// REGENERATE QR
// No request body required
// =======================================================

const regenerateQRSchema = Joi.object({}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// PARAM VALIDATION
// =======================================================

const guestPassIdParamSchema = Joi.object({

  id: objectId,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// QUERY VALIDATION
// =======================================================

const guestPassQuerySchema = Joi.object({

  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),

  status: Joi.string()
    .valid(
      "active",
      "suspended",
      "cancelled",
      "expired"
    )
    .optional(),

  passType: Joi.string()
    .valid(
      "one_time",
      "multi_day",
      "permanent"
    )
    .optional(),

  keyword: Joi.string()
    .trim()
    .max(100)
    .allow("", null),

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// EXPORTS
// =======================================================

module.exports = {

  // Body Schemas
  createGuestPassSchema,
  extendGuestPassSchema,
  cancelGuestPassSchema,
  updateNotesSchema,
  regenerateQRSchema,

  // Params
  guestPassIdParamSchema,

  // Query
  guestPassQuerySchema,

};