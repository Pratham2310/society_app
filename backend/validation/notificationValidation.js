const Joi = require("joi");

const expoToken = Joi.string()
  .pattern(/^ExponentPushToken\[[^\]]+\]$/)
  .required()
  .messages({
    "string.pattern.base":
      "token must be an Expo push token, e.g. ExponentPushToken[xxxxxxxx]",
  });

exports.registerDeviceSchema = Joi.object({
  token: expoToken,
  platform: Joi.string().valid("ios", "android").optional(),
  deviceId: Joi.string().max(200).optional(),
});

exports.unregisterDeviceSchema = Joi.object({
  token: expoToken,
});
