const Joi = require("joi");

// 🔥 CREATE EXPENSE
exports.createExpenseSchema = Joi.object({

  title: Joi.string()
    .min(3)
    .required()
    .messages({
      "string.empty": "Title is required"
    }),

  category: Joi.string()
    .valid("maintenance", "electricity", "security", "other")
    .required(),

  amount: Joi.number()
    .min(1)
    .required(),

  description: Joi.string().optional(),

  billFile: Joi.string().uri().optional(),

  visibleToResidents: Joi.boolean().optional()
});


// 🔥 TOGGLE VISIBILITY
exports.toggleVisibilitySchema = Joi.object({
  visible: Joi.boolean().required()
});