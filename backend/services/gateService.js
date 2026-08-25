const crypto = require("node:crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const VisitorRequest = require("../models/VisitorRequest");
const StaffProfile = require("../models/StaffProfile");
const StaffAttendance = require("../models/StaffAttendance");
const StaffAssignment = require("../models/StaffAssignment");
const SecurityAlert = require("../models/SecurityAlert");
const ResidentSecurityStatus = require("../models/ResidentSecurityStatus");

const notificationService = require("./notificationService");
const { generateQR } = require("../utils/qrGenerator");

const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");
const { SOCIETY_ROLES } = require("../utils/roles");

// =======================================================
// THE GATE
//
// What the app's security module reads. The older /security routes
// stay as they are — this is the plural, pass-shaped surface the phone
// uses, plus the pieces that were never built: gate passes, household
// staff approval, attendance marking and duty rosters.
//
// The recurring rule here is that a pass proves nothing on its own.
// Every scan is re-checked against the database at the moment of the
// scan: whether it is this society's, whether it has expired, whether
// the resident is away. A QR code is a lookup key, not a credential.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const isGuard = (user) =>
  user.societyRole === SOCIETY_ROLES.SECURITY ||
  has(user, PERMISSIONS.SECURITY_GATE);

const canManage = (user) => has(user, PERMISSIONS.SECURITY_MANAGE);

const requireManage = (user) => {
  if (!canManage(user)) {
    throw new AppError("Only the committee can do that.", 403);
  }
};

// Six characters, no vowels and no look-alikes, because this gets read
// aloud over a phone when the QR will not scan.
const ALPHABET = "23456789BCDFGHJKLMNPQRSTVWXYZ";

const newPassCode = () => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return code;
};

// The QR carries only what identifies the pass. Putting the visitor's
// name or the flat number in it would leak both to anyone who
// photographs the screen.
const buildPass = async ({ kind, id, societyId, passCode }) => {
  const payload = { v: 1, kind, id: String(id), societyId: String(societyId), passCode };
  return generateQR(payload);
};

// =======================================================
// RESIDENT SECURITY STATUS
//
// The app's vocabulary is safe / dnd / away; the record has always
// stored at_home / do_not_disturb / away.
// =======================================================

const TO_STORED = { safe: "at_home", dnd: "do_not_disturb", away: "away" };
const TO_APP = { at_home: "safe", do_not_disturb: "dnd", away: "away" };

const shapeStatus = (row) => {

  // A lapsed status is reported as "safe" rather than being written
  // back on read — a GET should not have side effects, and the next
  // write clears it anyway.
  const lapsed = row?.expiresAt && row.expiresAt.getTime() <= Date.now();

  return {
    status: lapsed ? "safe" : TO_APP[row?.status] || "safe",
    instruction: lapsed ? "" : row?.instructions || "",
    expiresAt: lapsed ? null : row?.expiresAt || null,
  };

};

exports.getMyStatus = async (req) => {

  const row = await ResidentSecurityStatus.findOne({
    residentId: req.user.id,
    societyId: asId(req.user.societyId),
  }).lean();

  return shapeStatus(row);

};

exports.setMyStatus = async (req) => {

  const key = String(req.body.status || "").toLowerCase();
  const stored = TO_STORED[key];

  if (!stored) throw new AppError("Unknown status.", 400);

  const minutes = Number(req.body.durationMinutes ?? 0);

  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new AppError("Enter a valid duration.", 400);
  }

  // Zero means "until I change it", which is the app's last option.
  const expiresAt =
    key === "safe" || minutes === 0
      ? null
      : new Date(Date.now() + minutes * 60_000);

  const row = await ResidentSecurityStatus.findOneAndUpdate(
    { residentId: req.user.id, societyId: asId(req.user.societyId) },
    {
      $set: {
        status: stored,
        instructions: String(req.body.instruction || "").trim(),
        expiresAt,
      },
    },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return shapeStatus(row);

};

// =======================================================
// PANIC
// =======================================================

exports.raisePanic = async (req) => {

  const societyId = asId(req.user.societyId);

  const alert = await SecurityAlert.create({
    societyId,
    residentId: req.user.id,
    type: "emergency",
    message: String(req.body?.message || "").trim() || "Emergency assistance needed.",
    status: "active",
  });

  // Every guard on the roster, not just whoever is nominally on duty —
  // an emergency is not the moment to be precise about shift times.
  const guards = await User.find({
    societyId,
    societyRole: SOCIETY_ROLES.SECURITY,
    status: "approved",
  })
    .select("_id")
    .lean();

  const me = await User.findById(req.user.id).select("name flatNumber").lean();

  try {
    await notificationService.notify({
      userIds: guards.map((g) => g._id),
      societyId,
      title: "EMERGENCY",
      message: `${me?.name || "A resident"}${me?.flatNumber ? ` (${me.flatNumber})` : ""} needs help now.`,
      type: "emergency",
      data: { alertId: String(alert._id) },
    });
  } catch {
    // The alert is recorded either way. A failed push must not lose it.
  }

  return alert.toObject();

};

exports.markSafe = async (req) => {

  const societyId = asId(req.user.societyId);

  const result = await SecurityAlert.updateMany(
    {
      societyId,
      residentId: req.user.id,
      type: "emergency",
      status: { $in: ["active", "acknowledged"] },
    },
    { $set: { status: "resolved", resolvedAt: new Date() } }
  );

  return { resolved: result.modifiedCount || 0 };

};

exports.acknowledgeAlert = async (req) => {

  if (!isGuard(req.user) && !canManage(req.user)) {
    throw new AppError("Only the gate can acknowledge an alert.", 403);
  }

  const alert = await SecurityAlert.findOneAndUpdate(
    {
      _id: req.params.id,
      societyId: asId(req.user.societyId),
      status: "active",
    },
    {
      $set: {
        status: "acknowledged",
        acknowledgedBy: req.user.id,
        acknowledgedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!alert) throw new AppError("No active alert with that id.", 404);

  // Whoever raised it wants to know somebody is coming, which is the
  // entire reason acknowledging is separate from resolving.
  try {
    await notificationService.notify({
      userIds: [alert.residentId],
      societyId: alert.societyId,
      title: "Help is on the way",
      message: "A guard has seen your alert and is responding.",
      type: "emergency",
      data: { alertId: String(alert._id) },
    });
  } catch { /* best effort */ }

  return alert;

};

// =======================================================
// VISITORS
// =======================================================

const shapeVisitor = (v) => ({
  _id: v._id,
  name: v.visitorName,
  phone: v.visitorPhone || "",
  purpose: v.purpose,
  visitorType: v.visitorType,
  vehicleNumber: v.vehicleNumber || "",
  status: v.status,
  passCode: v.passCode,
  qr: v.qr,
  passExpiresAt: v.passExpiresAt,
  entryTime: v.entryTime || null,
  exitTime: v.exitTime || null,
  resident: v.residentId?.name
    ? { name: v.residentId.name, flatNumber: v.residentId.flatNumber || "" }
    : undefined,
  createdAt: v.createdAt,
});

exports.listVisitors = async (req) => {

  const societyId = asId(req.user.societyId);
  const scope = req.query.scope || "mine";

  const filter = { societyId };

  if (scope === "mine") {
    filter.residentId = req.user.id;
  } else if (scope === "today") {
    // A guard's shift view: everything raised today, plus anyone still
    // inside from before it. Someone who walked in last night and has
    // not left is very much the guard's problem now.
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    filter.$or = [
      { createdAt: { $gte: midnight } },
      { entryTime: { $ne: null }, exitTime: null },
    ];
  } else if (scope === "society") {
    if (!isGuard(req.user) && !canManage(req.user)) {
      throw new AppError("You can only see your own visitors.", 403);
    }
  }

  const rows = await VisitorRequest.find(filter)
    .populate("residentId", "name flatNumber")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return rows.map(shapeVisitor);

};

exports.getVisitor = async (req) => {

  const visitor = await VisitorRequest.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  })
    .populate("residentId", "name flatNumber")
    .lean();

  if (!visitor) throw new AppError("Visitor not found.", 404);

  // A resident sees their own; the gate and the committee see all.
  const mine = String(visitor.residentId?._id || visitor.residentId) === String(req.user.id);

  if (!mine && !isGuard(req.user) && !canManage(req.user)) {
    throw new AppError("That visitor is not yours.", 403);
  }

  return shapeVisitor(visitor);

};

exports.createVisitor = async (req) => {

  const societyId = asId(req.user.societyId);

  const name = String(req.body.name || req.body.visitorName || "").trim();
  const phone = String(req.body.phone || "").trim();
  const purpose = String(req.body.purpose || "").trim();

  if (name.length < 2) throw new AppError("Enter the visitor's name.", 400);
  if (!purpose) throw new AppError("Say why they are visiting.", 400);

  const guardRaised = isGuard(req.user);

  // A guard logging a walk-up has to say whose flat it is for. A
  // resident raising a pass is naming themselves.
  const residentId = guardRaised
    ? req.body.residentId
    : req.user.id;

  if (!residentId) {
    throw new AppError("Say which resident this visitor is for.", 400);
  }

  if (guardRaised) {
    const resident = await User.findOne({ _id: residentId, societyId })
      .select("_id")
      .lean();

    if (!resident) throw new AppError("That resident is not in this society.", 404);
  }

  const hours = Number(req.body.validHours ?? 24);

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
    throw new AppError("Enter a valid duration.", 400);
  }

  const allowedPurposes = ["delivery", "guest", "maintainance", "other"];

  const visitor = await VisitorRequest.create({
    societyId,
    residentId,
    visitorName: name,
    visitorPhone: phone,
    purpose: allowedPurposes.includes(purpose) ? purpose : "other",
    visitorType: ["delivery", "guest", "staff", "other"].includes(req.body.visitorType)
      ? req.body.visitorType
      : "guest",
    vehicleNumber: String(req.body.vehicleNumber || "").toUpperCase().trim() || undefined,
    messageToGaurd: req.body.message,
    // A pass the resident raised is pre-approved by definition — they
    // are the one expecting the visitor. A guard's walk-up is not.
    status: guardRaised ? "pending" : "approved",
    approvedAt: guardRaised ? undefined : new Date(),
    createdByGuard: guardRaised ? req.user.id : null,
    passCode: newPassCode(),
    passExpiresAt: new Date(Date.now() + hours * 3600_000),
  });

  visitor.qr = await buildPass({
    kind: "visitor",
    id: visitor._id,
    societyId,
    passCode: visitor.passCode,
  });

  await visitor.save();

  // A walk-up needs the resident to answer before the guard lets them
  // through.
  if (guardRaised) {
    try {
      await notificationService.notify({
        userIds: [residentId],
        societyId,
        title: "Someone is at the gate",
        message: `${name} — ${purpose}. Approve or turn them away.`,
        type: "visitor",
        data: { visitorId: String(visitor._id) },
      });
    } catch { /* best effort */ }
  }

  return shapeVisitor(visitor.toObject());

};

exports.approveVisitor = async (req) => {

  const societyId = asId(req.user.societyId);

  const visitor = await VisitorRequest.findOne({
    _id: req.params.id,
    societyId,
  }).lean();

  if (!visitor) throw new AppError("Visitor not found.", 404);

  // Only the resident being visited decides. A guard raising the
  // request cannot then approve it themselves.
  if (String(visitor.residentId) !== String(req.user.id)) {
    throw new AppError("That visitor is for another flat.", 403);
  }

  if (visitor.status !== "pending") {
    throw new AppError("That request has already been answered.", 409);
  }

  const reject = req.body?.approve === false || req.body?.reject === true;

  const updated = await VisitorRequest.findOneAndUpdate(
    { _id: req.params.id, societyId, status: "pending" },
    reject
      ? { $set: { status: "rejected", rejectedAt: new Date() } }
      : { $set: { status: "approved", approvedAt: new Date() } },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("That request has already been answered.", 409);

  if (updated.createdByGuard) {
    try {
      await notificationService.notify({
        userIds: [updated.createdByGuard],
        societyId,
        title: reject ? "Visitor turned away" : "Visitor approved",
        message: `${updated.visitorName} — ${reject ? "do not admit" : "let them through"}.`,
        type: "visitor",
        data: { visitorId: String(updated._id) },
      });
    } catch { /* best effort */ }
  }

  return shapeVisitor(updated);

};

exports.deleteVisitor = async (req) => {

  const societyId = asId(req.user.societyId);

  const visitor = await VisitorRequest.findOne({ _id: req.params.id, societyId })
    .select("residentId entryTime")
    .lean();

  if (!visitor) throw new AppError("Visitor not found.", 404);

  const mine = String(visitor.residentId) === String(req.user.id);

  if (!mine && !canManage(req.user)) {
    throw new AppError("That visitor is not yours.", 403);
  }

  // Somebody who is already inside is a gate record, not a draft. It
  // stays.
  if (visitor.entryTime) {
    throw new AppError("That visitor has already entered.", 409);
  }

  await VisitorRequest.deleteOne({ _id: req.params.id, societyId });

  return { removed: req.params.id };

};

exports.getVisitorPass = async (req) => {

  const visitor = await VisitorRequest.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!visitor) throw new AppError("Visitor not found.", 404);

  const mine = String(visitor.residentId) === String(req.user.id);

  if (!mine && !isGuard(req.user) && !canManage(req.user)) {
    throw new AppError("That pass is not yours.", 403);
  }

  return {
    _id: visitor._id,
    passCode: visitor.passCode,
    qr: visitor.qr,
    passExpiresAt: visitor.passExpiresAt,
    name: visitor.visitorName,
    status: visitor.status,
  };

};

// =======================================================
// SCANNING
//
// The guard points a camera at a pass. Everything the code claims is
// re-checked here against the record — a QR is a lookup key, not proof
// of anything.
// =======================================================

const parseScan = (raw) => {

  if (!raw) return null;

  // A typed-in pass code is as valid as a scanned one; the whole point
  // of the code is that it works when the camera will not.
  if (typeof raw === "string" && !raw.trim().startsWith("{")) {
    return { passCode: raw.trim().toUpperCase() };
  }

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      kind: parsed.kind,
      id: parsed.id,
      societyId: parsed.societyId,
      passCode: parsed.passCode,
    };
  } catch {
    return null;
  }

};

exports.scanPass = async (req) => {

  if (!isGuard(req.user)) {
    throw new AppError("Only the gate can scan a pass.", 403);
  }

  const societyId = asId(req.user.societyId);
  const scan = parseScan(req.body.raw ?? req.body.passCode);

  if (!scan?.passCode) throw new AppError("That is not a gate pass.", 400);

  // The society is taken from the guard's own token, never from the
  // code. A pass minted at another society must not scan here however
  // well-formed it is.
  if (scan.kind === "staff") {
    return scanStaffPass(scan, societyId, req.user);
  }

  const visitor = await VisitorRequest.findOne({
    passCode: scan.passCode,
    societyId,
  })
    .populate("residentId", "name flatNumber")
    .lean();

  if (!visitor) throw new AppError("That pass is not valid here.", 404);

  if (visitor.status === "rejected") {
    throw new AppError("That visitor was turned away.", 403);
  }

  if (visitor.status === "pending") {
    throw new AppError("The resident has not approved this visitor yet.", 409);
  }

  if (visitor.passExpiresAt && visitor.passExpiresAt.getTime() < Date.now()) {
    throw new AppError("That pass has expired.", 410);
  }

  if (visitor.exitTime) {
    throw new AppError("That pass has already been used and closed.", 409);
  }

  // One code covers both directions: first scan admits, second
  // releases. A guard at a gate should not have to pick a mode.
  const direction = visitor.entryTime ? "exit" : "entry";

  const updated = await VisitorRequest.findOneAndUpdate(
    {
      _id: visitor._id,
      societyId,
      ...(direction === "entry" ? { entryTime: null } : { exitTime: null }),
    },
    { $set: direction === "entry"
      ? { entryTime: new Date() }
      : { exitTime: new Date() } },
    { returnDocument: "after" }
  )
    .populate("residentId", "name flatNumber")
    .lean();

  if (!updated) throw new AppError("That pass was just scanned.", 409);

  // Whether the resident wants to be disturbed is checked at the gate,
  // at the moment of entry — not when the pass was made.
  let residentStatus = null;

  if (direction === "entry") {
    const status = await ResidentSecurityStatus.findOne({
      residentId: updated.residentId?._id || updated.residentId,
      societyId,
    }).lean();

    residentStatus = shapeStatus(status);

    try {
      await notificationService.notify({
        userIds: [updated.residentId?._id || updated.residentId],
        societyId,
        title: "Your visitor has arrived",
        message: `${updated.visitorName} entered at the gate.`,
        type: "visitor",
        data: { visitorId: String(updated._id) },
      });
    } catch { /* best effort */ }
  }

  return {
    kind: "visitor",
    direction,
    visitor: shapeVisitor(updated),
    residentStatus,
  };

};

const scanStaffPass = async (scan, societyId, guard) => {

  const staff = await StaffProfile.findOne({
    passCode: scan.passCode,
    societyId,
  }).lean();

  if (!staff) throw new AppError("That pass is not valid here.", 404);

  if (staff.verificationStatus === "blocked") {
    throw new AppError("That staff member is blocked.", 403);
  }

  if (staff.verificationStatus !== "approved") {
    throw new AppError("That staff member is not approved yet.", 409);
  }

  if (staff.passExpiresAt && staff.passExpiresAt.getTime() < Date.now()) {
    throw new AppError("That pass has expired.", 410);
  }

  const open = await StaffAttendance.findOne({
    staffId: staff._id,
    societyId,
    exitTime: null,
  });

  if (open) {
    open.exitTime = new Date();
    await open.save();
    return { kind: "staff", direction: "exit", staff, attendance: open.toObject() };
  }

  const attendance = await StaffAttendance.create({
    societyId,
    staffId: staff._id,
    residentId: staff.employedBy || guard.id,
    entryTime: new Date(),
    status: "present",
  });

  return {
    kind: "staff",
    direction: "entry",
    staff,
    attendance: attendance.toObject(),
  };

};

// =======================================================
// STAFF
// =======================================================

const shapeStaff = (s) => ({
  _id: s._id,
  name: s.name,
  phone: s.phone,
  role: s.role,
  status: s.verificationStatus,
  verificationStatus: s.verificationStatus,
  photo: s.photo || null,
  entryTime: s.entryTime || "",
  passCode: s.passCode,
  passExpiresAt: s.passExpiresAt,
  employedBy: s.employedBy || null,
  isActive: s.isActive !== false,
});

exports.listStaff = async (req) => {

  const societyId = asId(req.user.societyId);

  const filter = { societyId, isActive: { $ne: false } };

  if (req.query.active === "true") {
    filter.verificationStatus = "approved";
  }

  // A resident sees society staff plus their own household staff, not
  // their neighbours' maids.
  if (!isGuard(req.user) && !canManage(req.user)) {
    filter.$or = [{ employedBy: null }, { employedBy: req.user.id }];
  }

  const rows = await StaffProfile.find(filter)
    .sort({ role: 1, name: 1 })
    .limit(300)
    .lean();

  return rows.map(shapeStaff);

};

exports.getStaff = async (req) => {

  const staff = await StaffProfile.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!staff) throw new AppError("Staff member not found.", 404);

  return shapeStaff(staff);

};

exports.createStaff = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const role = String(req.body.role || "other").trim();

  if (name.length < 2) throw new AppError("Enter the staff member's name.", 400);
  if (!/^[0-9]{10}$/.test(phone)) throw new AppError("Enter a 10-digit number.", 400);

  const staff = await StaffProfile.create({
    societyId,
    name,
    phone,
    role: StaffProfile.schema.path("role").enumValues.includes(role) ? role : "other",
    photo: req.body.photo,
    idProofType: req.body.idProofType,
    idProofNumber: req.body.idProofNumber,
    address: req.body.address,
    entryTime: req.body.entryTime,
    // Society staff are hired by the committee, so they arrive
    // approved. Household staff go through the queue instead.
    verificationStatus: "approved",
  });

  // A guard needs to sign in; a gardener does not. Only create the
  // account when asked for one.
  if (req.body.createLogin) {

    const password = String(req.body.password || "");

    if (password.length < 6) {
      throw new AppError("Choose a password of at least 6 characters.", 400);
    }

    const existing = await User.findOne({ phone }).select("_id").lean();

    if (existing) {
      throw new AppError("Someone already signs in with that number.", 409);
    }

    const account = await User.create({
      name,
      phone,
      email: req.body.email || `${phone}@staff.local.invalid`,
      password: await bcrypt.hash(password, 10),
      societyId,
      societyRole: SOCIETY_ROLES.SECURITY,
      status: "approved",
      isVerified: true,
    });

    staff.userId = account._id;
    await staff.save();

  }

  return shapeStaff(staff.toObject());

};

exports.updateStaff = async (req) => {

  requireManage(req.user);

  const set = {};

  for (const field of ["name", "phone", "photo", "entryTime", "address",
    "idProofType", "idProofNumber"]) {
    if (req.body[field] !== undefined) set[field] = req.body[field];
  }

  if (req.body.role !== undefined) {
    const roles = StaffProfile.schema.path("role").enumValues;
    set.role = roles.includes(req.body.role) ? req.body.role : "other";
  }

  if (req.body.blocked !== undefined) {
    set.verificationStatus = req.body.blocked ? "blocked" : "approved";
    set.blockedReason = req.body.blocked ? req.body.blockedReason : undefined;
  }

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const staff = await StaffProfile.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!staff) throw new AppError("Staff member not found.", 404);

  return shapeStaff(staff);

};

exports.deleteStaff = async (req) => {

  const societyId = asId(req.user.societyId);

  const staff = await StaffProfile.findOne({ _id: req.params.id, societyId }).lean();

  if (!staff) throw new AppError("Staff member not found.", 404);

  // A resident may dismiss their own household staff. Society staff
  // are the committee's to remove.
  const mine = String(staff.employedBy || "") === String(req.user.id);

  if (!mine && !canManage(req.user)) {
    throw new AppError("That staff member is not yours to remove.", 403);
  }

  // Deactivate rather than delete: the attendance history is a record
  // of who was in the building and should survive the dismissal.
  await StaffProfile.updateOne(
    { _id: staff._id, societyId },
    { $set: { isActive: false, passCode: null, qr: null } }
  );

  await StaffAssignment.updateMany(
    { staffId: staff._id, societyId, isActive: true },
    { $set: { isActive: false, endedAt: new Date() } }
  );

  // A guard who no longer works here must stop being able to sign in.
  if (staff.userId) {
    await User.updateOne(
      { _id: staff.userId },
      { $set: { status: "rejected" }, $inc: { tokenVersion: 1 } }
    );
  }

  return { removed: staff._id };

};

// =======================================================
// HOUSEHOLD STAFF
//
// A resident's own maid or cook. They work inside somebody's flat, so
// the secretary approves them before they get a gate pass.
// =======================================================

exports.addHouseholdStaff = async (req) => {

  const societyId = asId(req.user.societyId);

  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const role = String(req.body.role || "other").trim();

  if (name.length < 2) throw new AppError("Enter their name.", 400);
  if (!/^[0-9]{10}$/.test(phone)) throw new AppError("Enter a 10-digit number.", 400);

  const roles = StaffProfile.schema.path("role").enumValues;

  const staff = await StaffProfile.create({
    societyId,
    name,
    phone,
    role: roles.includes(role) ? role : "other",
    entryTime: req.body.entryTime,
    photo: req.body.photo,
    employedBy: req.user.id,
    verificationStatus: "pending",
  });

  await StaffAssignment.create({
    societyId,
    residentId: req.user.id,
    staffId: staff._id,
  });

  return shapeStaff(staff.toObject());

};

exports.listPendingHouseholdStaff = async (req) => {

  requireManage(req.user);

  const rows = await StaffProfile.find({
    societyId: asId(req.user.societyId),
    employedBy: { $ne: null },
    verificationStatus: "pending",
    isActive: { $ne: false },
  })
    .populate("employedBy", "name flatNumber")
    .sort({ createdAt: -1 })
    .lean();

  return rows.map((s) => ({
    ...shapeStaff(s),
    resident: s.employedBy
      ? { name: s.employedBy.name, flatNumber: s.employedBy.flatNumber || "" }
      : null,
  }));

};

exports.decideHouseholdStaff = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);
  const approved = req.body?.approved;

  if (typeof approved !== "boolean") {
    throw new AppError("Say whether they are approved.", 400);
  }

  const staff = await StaffProfile.findOne({
    _id: req.params.id,
    societyId,
    verificationStatus: "pending",
  });

  if (!staff) throw new AppError("No pending staff member with that id.", 404);

  if (!approved) {
    staff.verificationStatus = "rejected";
    staff.blockedReason = req.body.reason;
    await staff.save();
    return shapeStaff(staff.toObject());
  }

  const days = Number(req.body.validDays ?? 90);

  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new AppError("Enter a validity between 1 and 365 days.", 400);
  }

  staff.verificationStatus = "approved";
  staff.passCode = newPassCode();
  staff.passExpiresAt = new Date(Date.now() + days * 86400_000);

  staff.qr = await buildPass({
    kind: "staff",
    id: staff._id,
    societyId,
    passCode: staff.passCode,
  });

  await staff.save();

  if (staff.employedBy) {
    try {
      await notificationService.notify({
        userIds: [staff.employedBy],
        societyId,
        title: "Staff approved",
        message: `${staff.name} can now be let in at the gate.`,
        type: "security_warning",
        data: { staffId: String(staff._id) },
      });
    } catch { /* best effort */ }
  }

  return shapeStaff(staff.toObject());

};

exports.getStaffPass = async (req) => {

  const staff = await StaffProfile.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!staff) throw new AppError("Staff member not found.", 404);

  const mine = String(staff.employedBy || "") === String(req.user.id);

  if (!mine && !isGuard(req.user) && !canManage(req.user)) {
    throw new AppError("That pass is not yours.", 403);
  }

  if (staff.verificationStatus !== "approved") {
    throw new AppError("That staff member has no pass yet.", 409);
  }

  return {
    _id: staff._id,
    name: staff.name,
    role: staff.role,
    passCode: staff.passCode,
    qr: staff.qr,
    passExpiresAt: staff.passExpiresAt,
  };

};

// =======================================================
// ATTENDANCE AND DUTY
// =======================================================

exports.markAttendance = async (req) => {

  if (!isGuard(req.user) && !canManage(req.user)) {
    throw new AppError("Only the gate can mark attendance.", 403);
  }

  const societyId = asId(req.user.societyId);
  const { staffId } = req.body;

  const staff = await StaffProfile.findOne({ _id: staffId, societyId }).lean();

  if (!staff) throw new AppError("Staff member not found.", 404);

  const status = ["present", "absent"].includes(req.body.status)
    ? req.body.status
    : "present";

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const open = await StaffAttendance.findOne({
    staffId,
    societyId,
    entryTime: { $gte: midnight },
    exitTime: null,
  });

  // A second "present" for someone already inside closes their day
  // rather than opening a duplicate.
  if (open && status === "present") {
    open.exitTime = new Date();
    await open.save();
    return { ...open.toObject(), direction: "exit" };
  }

  const record = await StaffAttendance.create({
    societyId,
    staffId,
    residentId: staff.employedBy || req.user.id,
    entryTime: status === "present" ? new Date() : undefined,
    status,
  });

  return { ...record.toObject(), direction: status === "present" ? "entry" : "absent" };

};

exports.listTodayAttendance = async (req) => {

  const societyId = asId(req.user.societyId);

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const filter = {
    societyId,
    $or: [
      { entryTime: { $gte: midnight } },
      { createdAt: { $gte: midnight } },
    ],
  };

  if (req.query.staffId) filter.staffId = req.query.staffId;

  const rows = await StaffAttendance.find(filter)
    .populate("staffId", "name role photo")
    .sort({ entryTime: -1 })
    .limit(300)
    .lean();

  return rows.map((r) => ({
    _id: r._id,
    staffId: r.staffId?._id || r.staffId,
    name: r.staffId?.name || "Staff",
    role: r.staffId?.role || "other",
    status: r.status,
    entryTime: r.entryTime || null,
    exitTime: r.exitTime || null,
  }));

};

exports.attendanceReport = async (req) => {

  requireManage(req.user);

  const month = Number(req.query.month);
  const year = Number(req.query.year);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("Enter a month between 1 and 12.", 400);
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError("Enter a valid year.", 400);
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const rows = await StaffAttendance.aggregate([
    {
      $match: {
        societyId: asId(req.user.societyId),
        entryTime: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: "$staffId",
        present: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
        },
        days: { $addToSet: { $dateToString: { format: "%Y-%m-%d", date: "$entryTime" } } },
      },
    },
  ]);

  if (!rows.length) return { month, year, staff: [] };

  const staff = await StaffProfile.find({ _id: { $in: rows.map((r) => r._id) } })
    .select("name role")
    .lean();

  const byId = new Map(staff.map((s) => [String(s._id), s]));

  return {
    month,
    year,
    staff: rows.map((r) => ({
      staffId: r._id,
      name: byId.get(String(r._id))?.name || "Staff",
      role: byId.get(String(r._id))?.role || "other",
      present: r.present,
      absent: r.absent,
      // Distinct days, because someone scanning in and out twice in one
      // day worked one day, not two.
      daysWorked: r.days.filter(Boolean).length,
    })),
  };

};

exports.listOnDuty = async (req) => {

  const societyId = asId(req.user.societyId);

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  // Anyone who scanned in today and has not scanned out.
  const open = await StaffAttendance.find({
    societyId,
    entryTime: { $gte: midnight },
    exitTime: null,
  })
    .populate("staffId", "name role phone photo")
    .lean();

  return open
    .filter((r) => r.staffId)
    .map((r) => ({
      _id: r.staffId._id,
      name: r.staffId.name,
      role: r.staffId.role,
      phone: r.staffId.phone,
      photo: r.staffId.photo || null,
      since: r.entryTime,
    }));

};

exports.listAssignments = async (req) => {

  const societyId = asId(req.user.societyId);

  // A resident sees who works for them; the committee sees everyone.
  const filter = { societyId, isActive: true };

  if (!canManage(req.user)) filter.residentId = req.user.id;

  const rows = await StaffAssignment.find(filter)
    .populate("staffId", "name role phone photo verificationStatus")
    .populate("residentId", "name flatNumber")
    .sort({ startedAt: -1 })
    .limit(300)
    .lean();

  return rows
    .filter((r) => r.staffId)
    .map((r) => ({
      _id: r._id,
      staff: shapeStaff(r.staffId),
      resident: r.residentId
        ? { _id: r.residentId._id, name: r.residentId.name, flatNumber: r.residentId.flatNumber || "" }
        : null,
      startedAt: r.startedAt,
    }));

};
