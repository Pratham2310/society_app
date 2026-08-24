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


// =======================================================
// UPDATE A SOCIETY
//
// Details only. societyCode is deliberately not editable: residents
// have it written down and read it out, and changing it would silently
// break every pending registration.
// =======================================================

exports.updateSociety = async (societyId, data) => {

  const allowed = {};

  for (const field of ["name", "address", "city", "state", "pincode", "status"]) {
    if (data[field] !== undefined) allowed[field] = data[field];
  }

  if (!Object.keys(allowed).length) {
    throw new AppError("Nothing to update", 400);
  }

  const updated = await Society.findByIdAndUpdate(
    societyId,
    { $set: allowed },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new AppError("Society not found", 404);
  }

  return updated;

};


// =======================================================
// DELETE A SOCIETY
//
// Refused while residents live in it. A society is the root of wings,
// flats, notices, complaints, gate logs and every resident account —
// deleting one with people in it is not a mistake anyone recovers from
// through the UI.
//
// The caller must repeat the society's name back, which is the only
// confirmation that survives a misplaced click.
// =======================================================

exports.deleteSociety = async (societyId, confirmName) => {

  const User = require("../models/User");
  const Wing = require("../models/Wing");
  const Flat = require("../models/Flats");

  const society = await Society.findById(societyId);

  if (!society) {
    throw new AppError("Society not found", 404);
  }

  if (String(confirmName || "").trim() !== society.name) {
    throw new AppError(
      "Type the society's name exactly to confirm deletion",
      400
    );
  }

  // The secretary created during onboarding does not count — they exist
  // because of the society, not independently of it.
  const residents = await User.countDocuments({
    societyId,
    societyRole: { $ne: "secretary" },
  });

  if (residents > 0) {
    throw new AppError(
      `${residents} ${residents === 1 ? "person lives" : "people live"} in this society. ` +
      `Remove them first, or set the society to handed_over instead of deleting it.`,
      409
    );
  }

  const { withTransaction } = require("../utils/transactionHelper");

  return withTransaction(async (session) => {

    const removed = {
      flats: (await Flat.deleteMany({ societyId }, { session })).deletedCount,
      wings: (await Wing.deleteMany({ societyId }, { session })).deletedCount,
      users: (await User.deleteMany({ societyId }, { session })).deletedCount,
    };

    await Society.deleteOne({ _id: societyId }, { session });

    return { deleted: true, ...removed };

  });

};


// =======================================================
// ASSIGN A SECRETARY
//
// Two ways in, because both happen: promote a resident who already
// lives there, or create the account outright when onboarding did not.
//
// A society has one secretary at a time, so whoever held it is stepped
// down to member in the same transaction — otherwise both would hold
// the role and the permission checks would pass for two people.
// =======================================================

exports.assignSecretary = async (societyId, data) => {

  const User = require("../models/User");
  const { withTransaction } = require("../utils/transactionHelper");

  const society = await Society.findById(societyId);

  if (!society) {
    throw new AppError("Society not found", 404);
  }

  return withTransaction(async (session) => {

    let incoming;

    if (data.userId) {

      incoming = await User.findOne({
        _id: data.userId,
        societyId,
      }).session(session);

      if (!incoming) {
        throw new AppError("That person does not live in this society", 404);
      }

    } else {

      const { name, email, phone, password } = data;

      if (!name || !email || !phone || !password) {
        throw new AppError(
          "A new secretary needs a name, email, phone and password",
          400
        );
      }

      const clash = await User.findOne({ email }).session(session);

      if (clash) {
        throw new AppError("A user with that email already exists", 409);
      }

      const created = await User.create([{
        name,
        email,
        phone,
        password: await bcrypt.hash(password, 10),
        systemRole: "user",
        societyRole: "member",
        societyId,
        status: "approved",
        isVerified: true,
        isOnboarded: true,
      }], { session });

      incoming = created[0];

    }

    // Step down the current holder before promoting, so the society
    // never has two secretaries at once.
    const outgoing = await User.findOneAndUpdate(
      { societyId, societyRole: "secretary", _id: { $ne: incoming._id } },
      { $set: { societyRole: "member" } },
      { new: true, session }
    );

    incoming.societyRole = "secretary";
    incoming.status = "approved";
    incoming.isVerified = true;

    await incoming.save({ session });

    await Society.updateOne(
      { _id: societyId },
      { $set: { secretaryId: incoming._id } },
      { session }
    );

    return {
      secretary: {
        _id: incoming._id,
        name: incoming.name,
        email: incoming.email,
        phone: incoming.phone,
        societyRole: incoming.societyRole,
      },
      steppedDown: outgoing
        ? { _id: outgoing._id, name: outgoing.name }
        : null,
    };

  });

};


// =======================================================
// SOCIETY MEMBERS
// Everyone in a society, for the "promote someone" picker.
// =======================================================

exports.listMembers = async (societyId) => {

  const User = require("../models/User");

  return User.find({ societyId })
    .select("name email phone societyRole flatNumber status")
    .sort({ societyRole: 1, name: 1 })
    .lean();

};
