const crypto = require("crypto");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const AppError = require("../utils/appError");

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

// Cryptographically random, unlike Math.random().
function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

exports.sendOtp = async (phone) => {

  let user = await User.findOne({ phone })
    .select("+otpLastSentAt +otpHash +otpAttempts");

  if (!user) {
    user = new User({ phone });
  }

  // Throttle resends per account, independent of the IP rate limiter.
  if (
    user.otpLastSentAt &&
    Date.now() - user.otpLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {

    const wait = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - user.otpLastSentAt.getTime())) / 1000
    );

    throw new AppError(
      `Please wait ${wait} seconds before requesting another OTP.`,
      429
    );

  }

  const otp = generateOtp();

  user.otpHash = await bcrypt.hash(otp, 10);
  user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  user.isOtpVerified = false;

  await user.save();

  // TODO: hand `otp` to the SMS provider here.
  // It must never be logged and must never be returned to the caller.
  // Outside production the code is surfaced only so local development
  // can complete the flow without an SMS gateway.
  if (process.env.NODE_ENV !== "production") {
    return { devOtp: otp };
  }

  return {};

};

exports.verifyOtp = async (phone, otp) => {

  const user = await User.findOne({ phone })
    .select("+otpHash +otpAttempts");

  if (!user || !user.otpHash) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {

    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save();

    throw new AppError("Invalid or expired OTP", 400);

  }

  if (user.otpAttempts >= MAX_ATTEMPTS) {

    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save();

    throw new AppError(
      "Too many incorrect attempts. Request a new OTP.",
      429
    );

  }

  const matches = await bcrypt.compare(String(otp), user.otpHash);

  if (!matches) {

    user.otpAttempts += 1;
    await user.save();

    throw new AppError("Invalid or expired OTP", 400);

  }

  user.isOtpVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;

  await user.save();

  return true;

};
