const Joi = require("joi");

exports.recordPaymentSchema =
  Joi.object({

    paymentMethod: Joi.string()
      .valid(
        "cash",
        "upi",
        "bank_transfer",
        "cheque"
      )
      .required(),

    referenceNumber: Joi.string()
      .allow("", null),

    notes: Joi.string()
      .allow("", null)
  });