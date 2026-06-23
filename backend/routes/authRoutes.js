const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const asyncHandler=require("../utils/asyncHandler");
const validate=require("../middleware/validate");
const {registerSchema,loginSchema}=require("../validation/authValidation")
// const otpLimiter=require("../middleware/rateLimitMiddleware");

router.post("/register",validate(registerSchema), asyncHandler(authController.register));
router.post("/login", validate(loginSchema), asyncHandler(authController.login));
router.post("/send-otp",asyncHandler(authController.sendOtp));
router.post("/verify-otp", asyncHandler(authController.verifyOtp));

module.exports = router;