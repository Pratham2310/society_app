const bcrypt = require("bcrypt");
const Society = require("../models/Society");
const User = require("../models/User");
const AppError = require("../utils/appError");
const generateSocietyCode = require("../utils/generateSocietyCode");

exports.createSociety = async (data, session) => {
  const {
    name,
    address,
    city,
    state,
    pincode,
    subscriptionPlan,
    createdBy
  } = data;

  // Duplicate check (inside transaction not required but okay)
  const existingSociety = await Society.findOne({ name, address });
  if (existingSociety) {
    throw new AppError("Society already exists with same name & address", 400);
  }

  // Generate unique code
  let societyCode;
  let isUnique = false;

  while (!isUnique) {
    societyCode = await generateSocietyCode(name);
    const existingCode = await Society.findOne({ societyCode });
    if (!existingCode) isUnique = true;
  }

  // ✅ CREATE SOCIETY (ARRAY RETURN FIX)
  const societyArr = await Society.create([{
    name,
    address,
    city,
    state,
    pincode,
    subscriptionPlan,
    createdBy,
    societyCode
  }], { session });

  const society = societyArr[0];

  let secretary = null;

  if (data.secretary) {

    const existingUser = await User.findOne({ email: data.secretary.email });
    if (existingUser) {
      throw new AppError("Secretary email already exists", 400);
    }

    const hashedPassword = await bcrypt.hash(data.secretary.password, 10);

    // ✅ CREATE SECRETARY WITH SESSION
    const secArr = await User.create([{
      name: data.secretary.name,
      email: data.secretary.email,
      phone: data.secretary.phone,
      password: hashedPassword,
      systemRole: "user",
      societyRole: "secretary",
      societyId: society._id,
      status: "approved",
      isOnboarded: true
    }], { session });

    secretary = secArr[0];

    // ✅ LINK WITH SESSION
    society.secretaryId = secretary._id;
    await society.save({ session });
  }

  return { society, secretary };
};