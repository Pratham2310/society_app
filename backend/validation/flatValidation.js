const Joi = require("joi");

exports.createFlatSchema = Joi.object({

  flatNumber: Joi.string()
    .required(),

  wingId: Joi.string()
    .required(),

  floor: Joi.number()
    .required(),

  type: Joi.string()
    .required()

});