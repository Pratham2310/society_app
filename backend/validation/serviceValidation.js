const Joi = require("joi");

exports.createServiceSchema = Joi.object({

  name: Joi.string()
    .required(),

  category: Joi.string()
    .valid(
      "health",
      "education",
      "shopping",
      "maintenance",
      "emergency",
      "others"
    )
    .required(),

  description: Joi.string()
    .allow(""),

  phone: Joi.string()
    .required(),

  address: Joi.string()
    .allow(""),

  openTime: Joi.string()
    .allow(""),

  closeTime: Joi.string()
    .allow("")
});