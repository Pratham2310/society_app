const joi=require("joi");

exports.createFundSchema=joi.object({
    title:joi.string().required(),
    description:joi.string().optional(),
    targetAmount:joi.number().positive().required(),
    startDate:joi.date().optional(),
    endDate:joi.date().optional()
});

exports.contributeSchema=joi.object({
    amount:joi.number().positive().optional(),
    proof:joi.string().uri().optional()
});

exports.approvalSchema=joi.object({
    status:joi.string().valid("approved","rejected").required()
});