const mongoose = require("mongoose");

const User = require("../models/User");
const Society = require("../models/Society");
const ProfileChangeRequest = require("../models/ProfileChangeRequest");

const AppError = require("../utils/appError");
const { permissionsFor } = require("../config/permissions");

// =======================================================
// THE SIGNED-IN USER
//
// Everything here is scoped to req.user by construction: the caller
// never names whose profile to read or change, so there is no id to
// get wrong and no way to address someone else's record.
// =======================================================

// What the app's UserProfile actually reads. Sending the whole document
// would ship otpHash siblings and internal flags to every client on
// every launch.
const PROFILE_FIELDS =
  "name email phone systemRole societyRole societyId wingId flatId " +
  "flatNumber status isVerified avatar occupancyType livingType " +
  "familySize vehicles isOnboarded createdAt";

const shapeProfile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  systemRole: user.systemRole,
  societyRole: user.societyRole,
  societyId: user.societyId,
  wingId: user.wingId,
  flatId: user.flatId,
  // The app reads a flat *number*, not an id — a populated flat wins,
  // and the denormalised copy is the fallback for a resident whose flat
  // was removed from under them.
  flatNumber: user.flatId?.flatNumber || user.flatNumber || "",
  wingName: user.wingId?.name || "",
  status: user.status,
  isVerified: user.isVerified,
  avatar: user.avatar || null,
  occupancyType: user.occupancyType,
  livingType: user.livingType,
  familySize: user.familySize,
  vehicles: user.vehicles || [],
  isOnboarded: user.isOnboarded,
});

const loadMe = async (userId) => {

  const user = await User.findById(userId)
    .select(PROFILE_FIELDS)
    .populate("flatId", "flatNumber floor")
    .populate("wingId", "name")
    .lean();

  if (!user) throw new AppError("Your account no longer exists.", 404);

  return user;

};

exports.getMe = async (req) => shapeProfile(await loadMe(req.user.id));

// =======================================================
// PERMISSIONS
//
// Derived from the stored role rather than the token, so a role change
// takes effect on the next refresh instead of waiting out a 30-day
// mobile session.
// =======================================================

exports.getMyPermissions = async (req) => {

  const user = await User.findById(req.user.id)
    .select("systemRole societyRole")
    .lean();

  if (!user) throw new AppError("Your account no longer exists.", 404);

  return {
    societyRole: user.societyRole,
    systemRole: user.systemRole,
    permissions: permissionsFor(user),
  };

};

// =======================================================
// PROFILE EDITS
//
// These go to the secretary rather than applying directly. The
// society bills against these records and the gate checks them, so a
// resident renaming themselves is a request, not a write.
// =======================================================

const EDITABLE = ["name", "email", "occupancyType", "livingType", "familySize"];

exports.requestProfileChange = async (req) => {

  const current = await User.findById(req.user.id)
    .select(EDITABLE.join(" ") + " societyId")
    .lean();

  if (!current) throw new AppError("Your account no longer exists.", 404);

  const requested = {};
  const previous = {};

  for (const field of EDITABLE) {
    if (!(field in req.body)) continue;

    const next = req.body[field];
    if (next === undefined || next === null || next === "") continue;

    // Only record what actually differs. Submitting the form unchanged
    // should not create a request for the secretary to read.
    if (String(next) === String(current[field] ?? "")) continue;

    requested[field] = next;
    previous[field] = current[field] ?? null;
  }

  if (!Object.keys(requested).length) {
    throw new AppError("Nothing was changed.", 400);
  }

  // A second edit replaces the first rather than queueing behind it,
  // so the secretary always decides on what the resident wants now.
  const saved = await ProfileChangeRequest.findOneAndUpdate(
    { userId: req.user.id, status: "pending" },
    {
      $set: {
        societyId: current.societyId,
        userId: req.user.id,
        requested,
        previous,
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        rejectionReason: null,
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return saved;

};

exports.listProfileChangeRequests = async (req) => {

  const status = req.query.status || "pending";

  return ProfileChangeRequest.find({
    societyId: req.user.societyId,
    status,
  })
    .populate("userId", "name email phone flatNumber avatar")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

};

exports.decideProfileChange = async (req) => {

  const { userId } = req.params;
  const { approve, rejectionReason } = req.body;

  if (typeof approve !== "boolean") {
    throw new AppError("Say whether the change is approved.", 400);
  }

  if (!approve && !String(rejectionReason || "").trim()) {
    throw new AppError("Give the resident a reason.", 400);
  }

  const request = await ProfileChangeRequest.findOne({
    userId,
    societyId: req.user.societyId,
    status: "pending",
  });

  if (!request) throw new AppError("No pending change for that resident.", 404);

  const session = await mongoose.startSession();

  try {

    await session.withTransaction(async () => {

      if (approve) {
        // Apply only the fields that were actually requested, so a
        // stale copy of the rest cannot overwrite newer values.
        const update = {};
        for (const field of EDITABLE) {
          if (request.requested[field] !== undefined) {
            update[field] = request.requested[field];
          }
        }

        await User.updateOne(
          { _id: userId, societyId: req.user.societyId },
          { $set: update },
          { session }
        );
      }

      request.status = approve ? "approved" : "rejected";
      request.decidedBy = req.user.id;
      request.decidedAt = new Date();
      request.rejectionReason = approve ? null : String(rejectionReason).trim();

      await request.save({ session });

    });

  } finally {
    await session.endSession();
  }

  return request.toObject();

};

// =======================================================
// AVATAR
//
// A photo carries none of the weight the record fields do, so it
// applies immediately rather than going to the secretary.
// =======================================================

exports.setAvatar = async (req) => {

  const { avatar } = req.body;

  if (avatar !== null && typeof avatar !== "string") {
    throw new AppError("Send an image URL, or null to clear it.", 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: { avatar: avatar || null } },
    { returnDocument: "after" }
  ).select("avatar").lean();

  if (!user) throw new AppError("Your account no longer exists.", 404);

  return { avatar: user.avatar || null };

};

// =======================================================
// VEHICLES
//
// The guard reads these at the gate and parking is allocated from
// them, so a resident maintains their own list.
// =======================================================

const NUMBER_PATTERN = /^[A-Z0-9 -]{4,20}$/;

exports.listVehicles = async (req) => {

  const user = await User.findById(req.user.id).select("vehicles").lean();

  if (!user) throw new AppError("Your account no longer exists.", 404);

  return user.vehicles || [];

};

exports.addVehicle = async (req) => {

  const type = String(req.body.type || "").toLowerCase();
  const number = String(req.body.number || "").toUpperCase().trim();
  const parkingSlot = String(req.body.parkingSlot || "").trim();

  if (!["car", "bike"].includes(type)) {
    throw new AppError("A vehicle is either a car or a bike.", 400);
  }

  if (!NUMBER_PATTERN.test(number)) {
    throw new AppError("Enter a valid vehicle number.", 400);
  }

  const user = await User.findById(req.user.id).select("vehicles");

  if (!user) throw new AppError("Your account no longer exists.", 404);

  // The same plate twice is a mistake every time, and it would leave
  // the guard with two records to reconcile at the gate.
  if ((user.vehicles || []).some((v) => v.number === number)) {
    throw new AppError("That vehicle is already on your list.", 409);
  }

  user.vehicles.push({ type, number, parkingSlot: parkingSlot || undefined });

  await user.save();

  return user.vehicles[user.vehicles.length - 1];

};

exports.removeVehicle = async (req) => {

  const { vehicleId } = req.params;

  const user = await User.findById(req.user.id).select("vehicles");

  if (!user) throw new AppError("Your account no longer exists.", 404);

  const vehicle = user.vehicles.id(vehicleId);

  if (!vehicle) throw new AppError("That vehicle is not on your list.", 404);

  vehicle.deleteOne();

  await user.save();

  return { removed: vehicleId };

};

// =======================================================
// PUSH TOKENS
//
// A token identifies a device, not a person. A guard's tablet passes
// between shifts, so registering pulls the token off whoever held it
// last instead of leaving two users pointed at one device.
// =======================================================

exports.registerPushToken = async (req) => {

  const token = String(req.body.token || "").trim();
  const platform = req.body.platform;
  const deviceId = req.body.deviceId;

  if (!token) throw new AppError("A push token is required.", 400);

  await User.updateMany(
    { _id: { $ne: req.user.id }, "pushTokens.token": token },
    { $pull: { pushTokens: { token } } }
  );

  // Pull-then-push rather than an update in place, so re-registering
  // refreshes updatedAt instead of silently doing nothing.
  await User.updateOne(
    { _id: req.user.id },
    { $pull: { pushTokens: { token } } }
  );

  await User.updateOne(
    { _id: req.user.id },
    {
      $push: {
        pushTokens: {
          token,
          platform: ["ios", "android"].includes(platform) ? platform : undefined,
          deviceId: deviceId || undefined,
          updatedAt: new Date(),
        },
      },
    }
  );

  return { registered: true };

};

exports.removePushToken = async (req) => {

  const token = String(req.body.token || "").trim();

  if (!token) throw new AppError("A push token is required.", 400);

  await User.updateOne(
    { _id: req.user.id },
    { $pull: { pushTokens: { token } } }
  );

  return { removed: true };

};

// =======================================================
// THE CALLER'S SOCIETY
//
// Residents pay into whatever UPI details their committee set, so this
// has to come from the record rather than anything the client holds.
// =======================================================

exports.getMySociety = async (req) => {

  if (!req.user.societyId) {
    throw new AppError("You are not attached to a society.", 404);
  }

  const society = await Society.findById(req.user.societyId).lean();

  if (!society) throw new AppError("Society not found.", 404);

  return society;

};

exports.updateMySocietyPayment = async (req) => {

  const { upiId, payeeName, bankName, accountNumber, ifsc, notes } = req.body;

  const set = {};

  if (upiId !== undefined) set["payment.upiId"] = String(upiId || "").trim();
  if (payeeName !== undefined) set["payment.payeeName"] = String(payeeName || "").trim();
  if (bankName !== undefined) set["payment.bankName"] = String(bankName || "").trim();
  if (accountNumber !== undefined) set["payment.accountNumber"] = String(accountNumber || "").trim();
  if (ifsc !== undefined) set["payment.ifsc"] = String(ifsc || "").toUpperCase().trim();
  if (notes !== undefined) set["payment.notes"] = String(notes || "").trim();

  if (!Object.keys(set).length) {
    throw new AppError("Nothing was changed.", 400);
  }

  const society = await Society.findByIdAndUpdate(
    req.user.societyId,
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!society) throw new AppError("Society not found.", 404);

  return society;

};
