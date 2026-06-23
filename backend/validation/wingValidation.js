const Joi = require("joi");

exports.createWingSchema = Joi.object({

  name: Joi.string()
    .required()

});