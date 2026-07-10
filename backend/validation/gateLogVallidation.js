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
// Visitor Name
// ----------------------

const visitorName = Joi.string()
  .trim()
  .pattern(/^[A-Za-zÀ-ÿ' .-]+$/)
  .min(2)
  .max(100)
  .required()
  .messages({
    "string.empty": "Visitor name is required.",
    "string.min":
      "Visitor name must contain at least 2 characters.",
    "string.max":
      "Visitor name cannot exceed 100 characters.",
    "string.pattern.base":
      "Visitor name contains invalid characters.",
    "any.required":
      "Visitor name is required.",
  });

// ----------------------
// Visitor Phone
// ----------------------

const visitorPhone = Joi.string()
  .trim()
  .pattern(/^[0-9]{10}$/)
  .allow("", null)
  .messages({
    "string.pattern.base":
      "Visitor phone number must contain exactly 10 digits.",
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
    "any.only": "Invalid purpose.",
    "any.required": "Purpose is required.",
  });

// ----------------------
// Visitor Type
// ----------------------

const visitorType = Joi.string()
  .valid(
    "guest",
    "delivery",
    "staff",
    "resident",
    "emergency",
    "unknown"
  )
  .required()
  .messages({
    "any.only":
      "Invalid visitor type.",
    "any.required":
      "Visitor type is required.",
  });

// ----------------------
// Verification Method
// ----------------------

const verificationMethod = Joi.string()
  .valid(
    "qr",
    "manual",
    "resident_approval"
  )
  .required()
  .messages({
    "any.only":
      "Invalid verification method.",
    "any.required":
      "Verification method is required.",
  });

// ----------------------
// Device
// ----------------------

const device = Joi.string()
  .trim()
  .max(100)
  .default("Main Gate")
  .messages({
    "string.max":
      "Device name cannot exceed 100 characters.",
  });

// ----------------------
// Guard Note
// ----------------------

const guardNote = Joi.string()
  .trim()
  .max(500)
  .allow("", null)
  .messages({
    "string.max":
      "Guard note cannot exceed 500 characters.",
  });

// =======================================================
// QR VISITOR ENTRY
// =======================================================

const visitorEntryBodySchema = Joi.object({

  guestPassId: objectId.required(),

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// QR VISITOR EXIT
// =======================================================

const visitorExitBodySchema = Joi.object({

  guestPassId: objectId.required(),

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// MANUAL VISITOR ENTRY
// =======================================================

const manualVisitorEntryBodySchema = Joi.object({

  residentId: objectId.required(),

  flatId: objectId.required(),

  visitorName,

  visitorPhone,

  vehicleNumber,

  purpose,

  visitorType,

  verificationMethod,

  device,

  guardNote,

}).options({

  abortEarly: false,

  allowUnknown: false,

});



// =======================================================
// UPDATE REMARKS
// =======================================================

const remarks = Joi.string()
  .trim()
  .max(500)
  .required()
  .messages({
    "string.empty": "Remarks are required.",
    "string.max": "Remarks cannot exceed 500 characters.",
    "any.required": "Remarks are required.",
  });

const updateRemarksBodySchema = Joi.object({

  remarks,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// ADD GUARD NOTE
// =======================================================

const addGuardNoteBodySchema = Joi.object({

  guardNote,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// REJECT VISITOR
// =======================================================

const rejectionReason = Joi.string()
  .trim()
  .min(5)
  .max(500)
  .required()
  .messages({
    "string.empty": "Rejection reason is required.",
    "string.min":
      "Rejection reason must contain at least 5 characters.",
    "string.max":
      "Rejection reason cannot exceed 500 characters.",
    "any.required":
      "Rejection reason is required.",
  });

const rejectVisitorBodySchema = Joi.object({

  rejectionReason,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// PARAM VALIDATION
// =======================================================

const gateLogIdParamSchema = Joi.object({

  id: objectId.required(),

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// QUERY VALIDATION
// =======================================================

const listGateLogQuerySchema = Joi.object({

  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),

  visitorType: Joi.string()
    .valid(
      "guest",
      "delivery",
      "staff",
      "resident",
      "emergency",
      "unknown"
    )
    .optional(),

  verificationMethod: Joi.string()
    .valid(
      "qr",
      "manual",
      "resident_approval"
    )
    .optional(),

  keyword: Joi.string()
    .trim()
    .max(100)
    .allow("", null),

  startDate: Joi.date().optional(),

  endDate: Joi.date().optional(),

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// EXPORTS
// =======================================================

module.exports = {

  // Body Schemas
  visitorEntryBodySchema,

  visitorExitBodySchema,

  manualVisitorEntryBodySchema,

  updateRemarksBodySchema,

  addGuardNoteBodySchema,

  rejectVisitorBodySchema,

  // Param Schemas
  gateLogIdParamSchema,

  // Query Schemas
  listGateLogQuerySchema,

};