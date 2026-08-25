const authService = require("../services/authService");
const otpService = require("../services/otpServices");
const passwordResetService = require("../services/passwordResetService");
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
// =======================================================
// PASSWORD RESET
//
// Rate limited like the rest of auth. Neither handler reveals whether
// the account exists — see passwordResetService for why.
// =======================================================

exports.forgotPassword = async (req, res) => {
  const data = await passwordResetService.forgotPassword(req.body);
  sendResponse(res, 200, true, data.message, data);
};

exports.resetPassword = async (req, res) => {
  const data = await passwordResetService.resetPassword(req.body);
  sendResponse(res, 200, true, "Password updated. Sign in with your new password.", data);
};

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
