const joi=require("joi");

exports.createSchema=joi.object({
    slotNumber:joi.string().required(),
    type:joi.string().valid("resident","visitor").required(),
    wingId:joi.string().optional().allow(null,""),
});

exports.assignSchema=joi.object({
    flatId:joi.string().required(),
    vehivleNumber:joi.string().required(),
    vehicleType:joi.string().valid("car","bike").required(),
    ownerId:joi.string().optional()
});