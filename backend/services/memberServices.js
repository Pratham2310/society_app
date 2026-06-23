const User = require("../models/User");


// GET ALL MEMBERS OF SOCIETY
exports.getMembers = async (societyId) => {

  const members = await User.find({
    societyId: societyId
  }).select("-password");

  return members;

};



// VERIFY MEMBER
exports.verifyMember = async (memberId, societyId) => {

  const member = await User.findOne({
    _id: memberId,
    societyId: societyId
  });

  if (!member) {
    const err = new Error("Member not found");
    err.status = 404;
    throw err;
  }

  member.status = "verified";
  member.isVerified = true;

  await member.save();

  return member;

};



// CHANGE MEMBER ROLE
exports.changeRole = async (memberId, role, societyId) => {

  const member = await User.findOne({
    _id: memberId,
    societyId: societyId
  });

  if (!member) {
    const err = new Error("Member not found");
    err.status = 404;
    throw err;
  }

  member.role = role;

  await member.save();

  return member;

};