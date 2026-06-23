const Joi = require("joi");

// 🔥 GENERATE BILL
exports.generateBillSchema = Joi.object({

  amount: Joi.number()
    .min(1)
    .required(),

  dueDate: Joi.date()
    .required(),

  month: Joi.string()
    .required()
});