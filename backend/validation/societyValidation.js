const Joi = require("joi");

// CREATE SOCIETY VALIDATION
exports.createSocietySchema = Joi.object({

    name: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            "string.empty": "Society name is required",
            "string.min": "Society name must be at least 3 characters"
        }),

    city: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            "string.empty": "City is required"
        }),

    secretary: Joi.object({

        name: Joi.string().required(),

        email: Joi.string().email().required(),

        password: Joi.string().min(6).required(),

        phone: Joi.string().optional()

    }).required()

});


// VERIFY SOCIETY CODE VALIDATION
exports.verifySocietyCodeSchema = Joi.object({

    societyCode: Joi.string()
        .min(4)
        .max(10)
        .required()
        .messages({
            "string.empty": "Society code is required"
        })

});

exports.societyIdParamSchema = Joi.object({
  societyId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "societyId must be a valid id"
    })
});
