const User = require("../models/User");
const Flat = require("../models/Flats");
const AppError = require("../utils/appError");
const bcrypt = require("bcrypt");
const { withTransaction } = require("../utils/transactionHelper");

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

  const flat = await Flat.findOne({ societyId, wingId, flatNumber });

  if (!flat) throw new AppError("Flat not found", 404);
  if (flat.isOccupied) throw new AppError("Flat already occupied", 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  //Claiming the flat and writing the user must not come apart: a
  //failure between them would leave a registered resident whose flat
  //still shows as free, and the next person could take it.
  return withTransaction(async (session) => {

    //Atomic claim. A read-then-write would let two residents
    //registering for the same flat at the same moment both see
    //isOccupied:false and both succeed. Matching on isOccupied:false
    //inside the update means exactly one of them wins.
    const claimed = await Flat.findOneAndUpdate(
      { _id: flat._id, isOccupied: false },
      { $set: { isOccupied: true } },
      { new: true, session }
    );

    if (!claimed) {
      throw new AppError("Flat already occupied", 409);
    }

    existingUser.name = name;
    existingUser.email = email;
    existingUser.password = hashedPassword;
    existingUser.phone = phone;
    existingUser.societyId = societyId;
    existingUser.wingId = wingId;
    existingUser.flatId = claimed._id;
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

    await existingUser.save({ session });

    return existingUser;

  });
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

  if (!["secretary", "chairman"].includes(currUser.societyRole)) {
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
const allowedRoles = ["secretary", "committee_member", "treasurer", "member"];

exports.updateUserRole = async (currUser, targetUserId, newRole) => {
  if (currUser.societyRole !== "secretary") {
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
      societyRole: "secretary"
    });

    if (oldSecretary) {
      oldSecretary.societyRole = "member";
      await oldSecretary.save();
    }

    targetUser.societyRole = "secretary";
    await targetUser.save();

    return targetUser;
  }

  if (targetUser.societyRole === newRole) {
    throw new AppError("User already has this role", 400);
  }

  targetUser.societyRole = newRole;
  await targetUser.save();

  return targetUser;
};