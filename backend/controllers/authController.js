const authService = require("../services/authService");
const otpService = require("../services/otpServices");

// REGISTER (keep only for admin/internal use)
exports.register = async (req, res) => {

    const { name, email, password, societyId } = req.body;

    const user = await authService.registerUser(
        name,
        email,
        password,
        societyId
    );

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        user
    });
};

// 🔥 LOGIN (UPDATED)
exports.login = async (req, res) => {

    const { identifier, password } = req.body;

    const { user, token } = await authService.loginUser(identifier, password);

    res.json({
        success: true,
        token,
        user
    });
};

// SEND OTP
exports.sendOtp = async (req, res) => {
    const { phone } = req.body;

    await otpService.sendOtp(phone);

    res.json({
        success: true,
        message: "OTP sent successfully"
    });
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;

    await otpService.verifyOtp(phone, otp);

    res.json({
        success: true,
        message: "OTP verified successfully"
    });
};