const joi=require("joi");

exports.serviceFilterSchema=joi.object({
    category:joi.string()
    .valid(
        "health",
        "education",
        "shopping",
        "maintenance",
        "emergency",
        "others"
    )
    .optional()
    .messages({
        "any.only":"Invalid category"
    })
})