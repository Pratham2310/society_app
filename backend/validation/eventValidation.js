const joi=require("joi");

exports.createEventSchema=joi.object({
    title:joi.string().min(3).max(100).required(),
    description:joi.string().required(),
    eventDate:joi.date().required(),
    time:joi.string().required(),
    location:joi.string().required(),
});