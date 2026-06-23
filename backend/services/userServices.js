const User = require("../models/User");
const Flat = require("../models/Flats");
const AppError = require("../utils/appError");
const bcrypt = require("bcrypt");

// 🔥 REGISTER FULL USER
exports.registerFull = async (data) => {
  const {
    name,
    email,
    password,
    phone,
    societyId,
    wingId,
    flatNumber,
    occupancyType,
    livingType,
    familySize,
    vehicles,
    agreedToTerms,
    consentAlerts
  } = data;

  const existingUser = await User.findOne({ phone });

  if (!existingUser || !existingUser.isOtpVerified) {
    throw new AppError("User not verified with OTP", 400);
  }

  const flat = await Flat.findOne({ wingId, flatNumber });

  if (!flat) throw new AppError("Flat not found", 404);
  if (flat.isOccupied) throw new AppError("Flat already occupied", 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  existingUser.name = name;
  existingUser.email = email;
  existingUser.password = hashedPassword;
  existingUser.phone = phone;
  existingUser.societyId = societyId;
  existingUser.wingId = wingId;
  existingUser.flatNumber = flatNumber;
  existingUser.occupancyType = occupancyType;
  existingUser.livingType = livingType;
  existingUser.familySize = familySize;
  existingUser.vehicles = vehicles;
  existingUser.agreedToTerms = agreedToTerms;
  existingUser.consentAlerts = consentAlerts;

  existingUser.status = "pending";
  existingUser.isVerified = false;
  existingUser.isOtpVerified = false;

  await existingUser.save();

  flat.isOccupied = true;
  await flat.save();

  return existingUser;
};

// 🔥 GET PENDING USERS
exports.getPendingUsers = async (societyId) => {
  return await User.find({ societyId, status: "pending" }).select("-password");
};

// 🔥 UPDATE STATUS (SECURE VERSION)
exports.updateStatus = async (currUser, userId, status) => {
  const allowedStatus = ["approved", "rejected"];

  if (!allowedStatus.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  if (!["secretary", "chairman"].includes(currUser.societyrole)) {
    throw new AppError("Not authorized", 403);
  }

  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.societyId.toString() !== currUser.societyId.toString()) {
    throw new AppError("Cannot update user from another society", 403);
  }

  if (user.status !== "pending") {
    throw new AppError("User is not pending", 400);
  }

  user.status = status;

  if (status === "approved") {
    user.isVerified = true;
  }

  await user.save();

  return user;
};

// 🔥 GET ALL USERS
exports.getAllUsers = async (societyId) => {
  return await User.find({ societyId }).select("-password");
};

// 🔥 GET USERS BY WING
exports.getUserByWing = async (societyId, wingId) => {
  return await User.find({ societyId, wingId }).select("-password");
};

// 🔥 UPDATE ROLE
const allowedRoles = ["secretary", "comitee-member", "treasurer", "member"];

exports.updateUserRole = async (currUser, targetUserId, newRole) => {
  if (currUser.societyrole !== "secretary") {
    throw new AppError("Only secretary can update roles", 403);
  }

  if (!allowedRoles.includes(newRole)) {
    throw new AppError("Invalid role", 400);
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) throw new AppError("User not found", 404);

  if (targetUser.societyId.toString() !== currUser.societyId.toString()) {
    throw new AppError("Different society", 403);
  }

  if (newRole === "secretary") {
    const oldSecretary = await User.findOne({
      societyId: currUser.societyId,
      societyrole: "secretary"
    });

    if (oldSecretary) {
      oldSecretary.societyrole = "member";
      await oldSecretary.save();
    }

    targetUser.societyrole = "secretary";
    await targetUser.save();

    return targetUser;
  }

  if (targetUser.societyrole === newRole) {
    throw new AppError("User already has this role", 400);
  }

  targetUser.societyrole = newRole;
  await targetUser.save();

  return targetUser;
};