const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const asyncHandler=require("../utils/asyncHandler");
const validate=require("../middleware/validate");
const {registerSchema,loginSchema,sendOtpSchema,verifyOtpSchema}=require("../validation/authValidation");
const {otpLimiter,authLimiter}=require("../middleware/rateLimitMiddleware");

router.post("/register",authLimiter,validate(registerSchema), asyncHandler(authController.register));
router.post("/login",authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post("/send-otp",otpLimiter,validate(sendOtpSchema),asyncHandler(authController.sendOtp));
router.post("/verify-otp",otpLimiter,validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));

module.exports = router;
