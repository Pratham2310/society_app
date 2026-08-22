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
   
   phone: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required(),

   //NOTE: systemRole is deliberately NOT accepted here. Public
   //registration always creates an ordinary user; privileged roles
   //are granted by a superadmin or the bootstrap script.

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

exports.sendOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required()
});

exports.verifyOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  otp: Joi.string().pattern(/^[0-9]{6}$/).required()
});
