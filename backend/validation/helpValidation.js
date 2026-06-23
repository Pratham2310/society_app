const joi=require("joi");

const createHelplineSchema=joi.object({
    category:joi.string()
    .valid(
        "emergency",
        "households",
    "maintenance",
    "food",
    "security",
    "medical",
    "other")
    ,
     
    alternatePhone:joi.string().allow(),
    description:joi.string().allow(),
    availability:joi.string().allow(),
    isPlanned:joi.boolean()
});
