const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const AppError = require("../utils/appError");
const { JWT_ISSUER, JWT_AUDIENCE } = require("../middleware/authMiddleware");

// Web consoles are privileged and browser-based, so they get a much
// shorter window than a resident's phone.
const ttlForUser = (user) =>
  ["superadmin", "salesperson"].includes(user.systemRole) ? "8h" : "30d";

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      systemRole: user.systemRole,
      societyRole: user.societyRole,
      societyId: user.societyId,
      tokenVersion: user.tokenVersion || 0
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ttlForUser(user),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
};

// Never hand a Mongoose document straight to res.json().
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  systemRole: user.systemRole,
  societyRole: user.societyRole,
  societyId: user.societyId,
  status: user.status,
  isVerified: user.isVerified,
  isOnboarded: user.isOnboarded
});

// 🔥 REGISTER USER (SUPERADMIN / SALESPERSON / NORMAL USER)
const registerUser = async (data) => {
  //systemRole is intentionally ignored even if a client sends it —
  //accepting it here would let anyone self-register as superadmin.
  const { name, email, password, phone } = data;

  // Check existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    systemRole: "user",
    societyRole: "member"
  });

  // Generate token
  const token = generateToken(user);

  return {
    user: toPublicUser(user),
    token
  };
};

// 🔥 LOGIN USER
const loginUser = async (identifier, password) => {

  // loginSchema accepts an email or a 10-digit phone number.
  const query = String(identifier).includes("@")
    ? { email: String(identifier).toLowerCase() }
    : { phone: String(identifier) };

  // password is select:false on the schema, so ask for it explicitly.
  const user = await User.findOne(query).select("+password");

  if (!user || !user.password) {
    throw new AppError("Invalid credentials", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  // 🔥 ONLY RESTRICT NORMAL MEMBERS
  if (user.societyRole === "member" && user.systemRole === "user") {

    if (!user.isVerified) {
      throw new AppError("User not verified by secretary", 403);
    }

    if (user.status !== "approved") {
      throw new AppError("User not approved", 403);
    }
  }

  const token = generateToken(user);

  return { user: toPublicUser(user), token };
};

// 🔥 CREATE SALESPERSON (BY SUPERADMIN)
const createSalesperson = async (data, createdBy) => {
  const { name, email, password, phone } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("User already exists", 409);
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

  return toPublicUser(salesperson);
};

module.exports = {
  registerUser,
  loginUser,
  createSalesperson,
  generateToken,
  toPublicUser
};