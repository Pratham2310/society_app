const bcrypt = require("bcrypt");
const Society = require("../models/Society");
const Wing = require("../models/Wing");
const Flat = require("../models/Flats");
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

// =======================================================
// VERIFY SOCIETY CODE
//
// The first screen of the app calls this. The controller referenced
// it but it was never implemented, so joining a society failed with
// a TypeError before anyone could get past step one.
//
// Codes are six digits, nothing else. A resident reads them off a
// message or hears them over the phone, so letters would only add
// spelling, case and O/0 confusion.
// =======================================================

const CODE_PATTERN = /^[0-9]{6}$/;

exports.verifySocietyCode = async (societyCode) => {

  //Strip anything a person might type around the digits — spaces from
  //a copy-paste, a dash from reading it in pairs — then require
  //exactly six digits.
  const code = String(societyCode || "").replace(/[^0-9]/g, "");

  if (!CODE_PATTERN.test(code)) {
    throw new AppError("Society code must be 6 digits", 400);
  }

  const society = await Society.findOne({ societyCode: code })
    .select("name city societyCode")
    .lean();

  if (!society) {
    throw new AppError(
      "No society found with that code. Check it with your secretary.",
      404
    );
  }

  return society;

};


// =======================================================
// REGISTRATION STRUCTURE
//
// Wings, floors and flats for the "Where do you live?" step.
//
// This is deliberately reachable without a token: the resident is
// mid-registration and has no account yet — register-full is what
// creates it. The society code is the credential, and the client
// reaches this only after verify-code hands back a societyId.
//
// It returns the whole tree in one request rather than three
// cascading calls, because a society is a few hundred flats at most
// and a phone on mobile data should not make three round trips to
// fill one form.
//
// What it exposes: wing names, floor numbers, flat numbers, and
// whether each flat is taken. No resident names, no contact details,
// no ownership. That is a building's layout, which anyone standing
// outside it can already see.
// =======================================================

exports.getRegistrationStructure = async (societyId) => {

  const society = await Society.findById(societyId)
    .select("name city")
    .lean();

  if (!society) {
    throw new AppError("Society not found", 404);
  }

  const wings = await Wing.find({ societyId })
    .select("name totalFloors flatsPerFloor")
    .sort({ name: 1 })
    .lean();

  const flats = await Flat.find({ societyId })
    .select("wingId flatNumber floor isOccupied")
    .sort({ floor: 1, flatNumber: 1 })
    .lean();

  //Group flats under their wing and floor so the client can drive the
  //cascade without re-querying at each step.
  const byWing = new Map();

  for (const flat of flats) {

    const wingKey = String(flat.wingId);

    if (!byWing.has(wingKey)) {
      byWing.set(wingKey, new Map());
    }

    const floors = byWing.get(wingKey);

    if (!floors.has(flat.floor)) {
      floors.set(flat.floor, []);
    }

    floors.get(flat.floor).push({
      _id: flat._id,
      flatNumber: flat.flatNumber,
      isOccupied: Boolean(flat.isOccupied),
    });

  }

  return {
    society: {
      _id: society._id,
      name: society.name,
      city: society.city || null,
    },
    wings: wings.map((wing) => {

      const floors = byWing.get(String(wing._id)) || new Map();

      return {
        _id: wing._id,
        name: wing.name,
        totalFloors: wing.totalFloors,
        flatsPerFloor: wing.flatsPerFloor,
        floors: [...floors.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([floor, flatsOnFloor]) => ({
            floor,
            flats: flatsOnFloor,
            //A floor with nothing left is worth greying out whole
            //rather than making someone open it to find out.
            availableCount: flatsOnFloor.filter((f) => !f.isOccupied).length,
          })),
      };

    }),
  };

};
