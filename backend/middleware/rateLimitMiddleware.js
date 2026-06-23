// const rateLimit = require("express-rate-limit");
// const { ipKeyGenerator } = require("express-rate-limit");

// const otpLimiter = rateLimit({
//   windowMs: 60 * 1000, // 1 minute
//   max: 5, // max requests per minute

//   keyGenerator: (req) => {
//     // use phone number first, otherwise fallback to safe IP generator
//     return req.body.phone || ipKeyGenerator(req);
//   },

//   message: {
//     success: false,
//     message: "Too many OTP requests. Please try again later."
//   },

//   standardHeaders: true,
//   legacyHeaders: false
// });

// module.exports = otpLimiter;