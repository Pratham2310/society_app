const Joi = require("joi");

exports.updateUserSchema = Joi.object({

  name: Joi.string(),

  phone: Joi.string(),

  profilePicture: Joi.string()

});