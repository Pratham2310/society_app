const Joi = require("joi");

exports.generateGuestPassSchema = Joi.object({

  guestName: Joi.string()
    .min(2)
    .max(100)
    .required(),

  guestPhone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required(),

  purpose: Joi.string()
    .valid(
      "family",
      "friend",
      "delivery",
      "maintenance",
      "business",
      "other"
    )
    .required(),

  vehicleNumber: Joi.string()
    .allow("", null),

  numberOfGuests: Joi.number()
    .min(1)
    .max(20)
    .default(1),

  arrivalDate: Joi.date()
    .required(),

  expiryDate: Joi.date()
    .greater(Joi.ref("arrivalDate"))
    .required()
});