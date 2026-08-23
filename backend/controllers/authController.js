const authService = require("../services/authService");
const otpService = require("../services/otpServices");
const { sendResponse } = require("../utils/responseHelper");

// REGISTER
exports.register = async (req, res) => {

    // registerUser expects a single object; passing positional
    // arguments here is what previously produced malformed users.
    const { user, token } = await authService.registerUser(req.body);

    sendResponse(res, 201, true, "User registered successfully", {
        user,
        token
    });
};

// LOGIN
exports.login = async (req, res) => {

    const { identifier, password } = req.body;

    const { user, token } = await authService.loginUser(identifier, password);

    sendResponse(res, 200, true, "Logged in successfully", {
        user,
        token
    });
};

// SEND OTP
exports.sendOtp = async (req, res) => {
    const { phone } = req.body;

    const result = await otpService.sendOtp(phone);

    // devOtp is only ever populated outside production.
    sendResponse(res, 200, true, "OTP sent successfully", result);
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;

    await otpService.verifyOtp(phone, otp);

    sendResponse(res, 200, true, "OTP verified successfully");
};
