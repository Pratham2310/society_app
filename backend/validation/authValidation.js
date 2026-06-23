const Joi = require("joi")

exports.registerSchema = Joi.object({

   name: Joi.string()
      .min(3)
      .max(50)
      .required(),

   email: Joi.string()
      .email()
      .required(),

   password: Joi.string()
      .min(6)
      .required(),
   
   role:Joi.string().valid("superadmin","salesperson","secretary","treasurer","comitee-member","member").required(),

   societyId: Joi.string()
      .optional()

})


exports.loginSchema = Joi.object({
  identifier: Joi.alternatives().try(
    Joi.string().email(),
    Joi.string().pattern(/^[0-9]{10}$/)
  ).required(),
  password: Joi.string().min(6).required()
});