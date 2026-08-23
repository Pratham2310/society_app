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
// Exactly six digits. Nothing alphanumeric is accepted: the code is
// read out over the phone and typed into six boxes, so letters would
// only introduce spelling, case and O/0 confusion.
exports.verifySocietyCodeSchema = Joi.object({

    societyCode: Joi.string()
        .trim()
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
            "string.empty": "Society code is required",
            "string.pattern.base": "Society code must be 6 digits"
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
