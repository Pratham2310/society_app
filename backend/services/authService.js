const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// 🔥 GENERATE TOKEN (UPDATED)
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      systemRole: user.systemRole,
      societyRole: user.societyRole,
      societyId: user.societyId
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// 🔥 REGISTER USER (SUPERADMIN / SALESPERSON / NORMAL USER)
const registerUser = async (data) => {
  const { name, email, password, phone, systemRole } = data;

  // Check existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    systemRole: systemRole || "user", // default user
    societyRole: "member"
  });

  // Generate token
  const token = generateToken(user);

  return {
    user,
    token
  };
};

// 🔥 LOGIN USER
const loginUser = async (email, password) => {

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // 🔥 ONLY RESTRICT NORMAL MEMBERS
  if (user.societyRole === "member" && user.systemRole === "user") {

    if (!user.isVerified) {
      throw new Error("User not verified by secretary");
    }

    if (user.status !== "approved") {
      throw new Error("User not approved");
    }
  }

  const token = generateToken(user);

  return { user, token };
};

// 🔥 CREATE SALESPERSON (BY SUPERADMIN)
const createSalesperson = async (data, createdBy) => {
  const { name, email, password, phone } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const salesperson = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    systemRole: "salesperson",
    createdBy
  });

  return salesperson;
};

module.exports = {
  registerUser,
  loginUser,
  createSalesperson,
  generateToken
};