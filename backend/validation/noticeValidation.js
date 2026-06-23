const Joi = require("joi");

exports.createNoticeSchema = Joi.object({

  title: Joi.string()
    .required(),

  content: Joi.string()
    .required(),

  type: Joi.string()
    .valid(
      "announcement",
      "general",
      "maintenance",
      "security"
    )
    .required(),

  isUrgent: Joi.boolean()
});