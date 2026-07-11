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
  .required()
  .messages({
    "string.empty":
      "Visitor phone number is required.",
    "string.pattern.base":
      "Visitor phone number must contain exactly 10 digits.",
    "any.required":
      "Visitor phone number is required.",
  });

// ----------------------
// Visitor Photo
// ----------------------

const visitorPhoto = Joi.string()
  .uri()
  .allow("", null)
  .messages({
    "string.uri":
      "Visitor photo must be a valid URL.",
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
    "any.only":
      "Invalid purpose selected.",
    "any.required":
      "Purpose is required.",
  });

// ----------------------
// Number Of Visitors
// ----------------------

const numberOfVisitors = Joi.number()
  .integer()
  .min(1)
  .max(20)
  .default(1)
  .messages({
    "number.base":
      "Number of visitors must be a number.",
    "number.min":
      "At least one visitor is required.",
    "number.max":
      "Maximum 20 visitors are allowed.",
  });

// ----------------------
// Rejection Reason
// ----------------------

const rejectionReason = Joi.string()
  .trim()
  .min(3)
  .max(300)
  .required()
  .messages({
    "string.empty":
      "Rejection reason is required.",
    "string.min":
      "Rejection reason must contain at least 3 characters.",
    "string.max":
      "Rejection reason cannot exceed 300 characters.",
    "any.required":
      "Rejection reason is required.",
  });

// =======================================================
// REQUEST APPROVAL
// =======================================================

const requestApprovalBodySchema = Joi.object({

  residentId: objectId,

  flatId: objectId,

  wingId: objectId,

  visitorName,

  visitorPhone,

  visitorPhoto,

  vehicleNumber,

  purpose,

  numberOfVisitors,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// APPROVE REQUEST
// =======================================================

const approveRequestBodySchema = Joi.object({

  approvalId: objectId,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// REJECT REQUEST
// =======================================================

const rejectRequestBodySchema = Joi.object({

  approvalId: objectId,

  rejectionReason,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// CANCEL REQUEST
// =======================================================

const cancelRequestBodySchema = Joi.object({

  approvalId: objectId,

}).options({

  abortEarly: false,

  allowUnknown: false,

});

// =======================================================
// EXPORTS
// =======================================================

module.exports = {

  requestApprovalBodySchema,

  approveRequestBodySchema,

  rejectRequestBodySchema,

  cancelRequestBodySchema,

};