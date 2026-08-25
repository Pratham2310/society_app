const bcrypt = require("bcrypt");

const User = require("../models/User");
const otpServices = require("./otpServices");
const AppError = require("../utils/appError");
const { runUnscoped } = require("../utils/tenantContext");

// =======================================================
// PASSWORD RESET
//
// Reuses the OTP the app already sends at registration rather than
// mailing a link. The resident is holding the phone the society has on
// file, which is the same proof either way, and it saves standing up
// mail delivery for one flow.
//
// Nothing here says whether an account exists. Answering that turns
// the endpoint into a way to test which phone numbers and emails are
// registered, so an unknown identifier gets the same reply as a known
// one and simply never receives a code.
// =======================================================

// The reset happens before sign-in, so there is no tenant in context.
// Without this the scope plugin would constrain the lookup to a
// society nobody has selected yet and find nothing.
const findByIdentifier = (identifier) =>
  runUnscoped(() =>
    User.findOne({
      $or: [
        { email: String(identifier).toLowerCase().trim() },
        { phone: String(identifier).trim() },
      ],
    })
      .select("+otpHash +otpAttempts +otpLastSentAt phone email")
      .lean()
  );

exports.forgotPassword = async ({ identifier }) => {

  if (!String(identifier || "").trim()) {
    throw new AppError("Enter your email or mobile number.", 400);
  }

  const user = await findByIdentifier(identifier);

  // Deliberately the same answer either way.
  const answer = {
    sent: true,
    message: "If that account exists, a code has been sent to its mobile number.",
  };

  if (!user?.phone) return answer;

  try {
    const result = await runUnscoped(() => otpServices.sendOtp(user.phone));

    // Outside production the OTP service hands the code back so the
    // flow can be walked without an SMS provider.
    if (result?.devOtp) return { ...answer, devOtp: result.devOtp };

  } catch (err) {

    // A throttle is worth surfacing — the resident pressing the button
    // twice should be told to wait, not left staring at a silent
    // success. Anything else stays quiet.
    if (err?.statusCode === 429) throw err;

  }

  return answer;

};

exports.resetPassword = async ({ identifier, otp, newPassword }) => {

  if (!String(identifier || "").trim()) {
    throw new AppError("Enter your email or mobile number.", 400);
  }

  if (!String(otp || "").trim()) {
    throw new AppError("Enter the code we sent you.", 400);
  }

  if (String(newPassword || "").length < 6) {
    throw new AppError("Choose a password of at least 6 characters.", 400);
  }

  const user = await findByIdentifier(identifier);

  // Here the answer cannot be blurred — a wrong code and an unknown
  // account both have to fail, and they fail the same way.
  if (!user?.phone) {
    throw new AppError("That code is not valid.", 400);
  }

  // verifyOtp does the attempt counting and expiry, and throws on a
  // bad code. Repeating that logic here would be a second place for it
  // to drift.
  await runUnscoped(() => otpServices.verifyOtp(user.phone, String(otp).trim()));

  const hashed = await bcrypt.hash(newPassword, 10);

  await runUnscoped(() =>
    User.updateOne(
      { _id: user._id },
      {
        $set: { password: hashed },
        // Every session issued before the reset stops working. If the
        // reset was because someone else had the account, leaving their
        // token alive would defeat the whole exercise.
        $inc: { tokenVersion: 1 },
      }
    )
  );

  return { reset: true };

};
