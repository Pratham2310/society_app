const mongoose = require("mongoose");

const Event = require("../models/Events");
const Notice = require("../models/Notice");
const Helpline = require("../models/Helpline");
const ParkingSlot = require("../models/ParkingSlot");
const SocietyService = require("../models/SocietyService");

const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");

// =======================================================
// COMMUNITY
//
// The smaller surfaces the app expects, grouped because none of them
// is big enough to be its own service and all of them are the same
// shape of work: an existing model, read the way a screen reads it.
//
// Where a field name differs, the translation happens here rather than
// by renaming a model the web console also reads. The helpline model
// has always stored title/phone; the app calls them label/number.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const requirePermission = (user, permission, message) => {
  if (!has(user, permission)) throw new AppError(message, 403);
};

// =======================================================
// EVENTS
//
// Attending and having paid are separate questions. The app shows both
// counts, and a paid event that only tracked attendance could not tell
// the organiser who still owes.
// =======================================================

const shapeEvent = (event, userId) => {

  const accepted = event.acceptedMembers || [];
  const paid = event.paidMembers || [];

  return {
    ...event,
    attendeeCount: accepted.length,
    isAttending: accepted.some((m) => String(m) === String(userId)),
    paidCount: paid.length,
    isPaid: paid.some((p) => String(p.userId) === String(userId)),
    fee: Number(event.fee || 0),
  };

};

exports.getEvent = async (req) => {

  const event = await Event.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!event) throw new AppError("Event not found.", 404);

  return shapeEvent(event, req.user.id);

};

exports.rsvpEvent = async (req) => {

  const societyId = asId(req.user.societyId);

  const event = await Event.findOne({ _id: req.params.id, societyId }).lean();

  if (!event) throw new AppError("Event not found.", 404);

  if (event.status === "cancelled") {
    throw new AppError("That event was cancelled.", 409);
  }

  const attending = (event.acceptedMembers || [])
    .some((m) => String(m) === String(req.user.id));

  // The app sends a bare POST and expects the answer to flip, so this
  // toggles rather than taking a desired state from the body.
  const update = attending
    ? { $pull: { acceptedMembers: req.user.id } }
    : { $addToSet: { acceptedMembers: req.user.id } };

  const updated = await Event.findOneAndUpdate(
    { _id: req.params.id, societyId },
    update,
    { returnDocument: "after" }
  ).lean();

  return shapeEvent(updated, req.user.id);

};

exports.payForEvent = async (req) => {

  const societyId = asId(req.user.societyId);

  const event = await Event.findOne({ _id: req.params.id, societyId }).lean();

  if (!event) throw new AppError("Event not found.", 404);

  const fee = Number(event.fee || 0);

  if (fee <= 0) throw new AppError("That event is free.", 400);

  const already = (event.paidMembers || [])
    .some((p) => String(p.userId) === String(req.user.id));

  if (already) throw new AppError("You have already paid for this event.", 409);

  const amount = Number(req.body?.amount ?? fee);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Enter a valid amount.", 400);
  }

  const updated = await Event.findOneAndUpdate(
    {
      _id: req.params.id,
      societyId,
      // Guards the gap between the read above and this write: two taps
      // in quick succession would otherwise both pass the check and
      // record the payment twice.
      "paidMembers.userId": { $ne: req.user.id },
    },
    {
      $push: { paidMembers: { userId: req.user.id, amount, paidAt: new Date() } },
      // Paying for something is a stronger signal than an RSVP, so it
      // implies one.
      $addToSet: { acceptedMembers: req.user.id },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("You have already paid for this event.", 409);

  return shapeEvent(updated, req.user.id);

};

exports.listEventContributors = async (req) => {

  const event = await Event.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  })
    .populate("paidMembers.userId", "name flatNumber avatar")
    .lean();

  if (!event) throw new AppError("Event not found.", 404);

  return (event.paidMembers || []).map((p) => ({
    _id: p.userId?._id || p.userId,
    name: p.userId?.name || "Resident",
    flatNumber: p.userId?.flatNumber || "",
    avatar: p.userId?.avatar || null,
    amount: p.amount,
    date: p.paidAt,
  }));

};

// =======================================================
// NOTICES
// =======================================================

exports.acknowledgeNotice = async (req) => {

  const societyId = asId(req.user.societyId);

  // addToSet on the userId alone would not dedupe, because each entry
  // carries its own timestamp. The filtered update does.
  const updated = await Notice.findOneAndUpdate(
    {
      _id: req.params.id,
      societyId,
      "acknowledgedBy.userId": { $ne: req.user.id },
    },
    { $push: { acknowledgedBy: { userId: req.user.id, at: new Date() } } },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {

    // Either the notice is gone or it was already acknowledged. Saying
    // which matters: re-reading a notice must not look like an error.
    const exists = await Notice.exists({ _id: req.params.id, societyId });

    if (!exists) throw new AppError("Notice not found.", 404);

    return { acknowledged: true, alreadyAcknowledged: true };

  }

  return {
    acknowledged: true,
    acknowledgedCount: updated.acknowledgedBy.length,
  };

};

// =======================================================
// HELPLINE
//
// Stored as title/phone since before the app called them label/number.
// =======================================================

const shapeHelpline = (row) => ({
  _id: row._id,
  label: row.title,
  number: row.phone,
  alternateNumber: row.alternatePhone || "",
  description: row.description || "",
  icon: row.category,
  category: row.category,
  availability: row.availability,
  isPinned: row.isPinned,
});

const HELPLINE_CATEGORIES = [
  "emergency", "housholds", "maintenance",
  "food", "security", "medical", "other",
];

exports.listHelpline = async (req) => {

  const rows = await Helpline.find({
    societyId: asId(req.user.societyId),
    isActive: true,
  })
    .sort({ isPinned: -1, title: 1 })
    .lean();

  return rows.map(shapeHelpline);

};

const helplineBody = (body) => {

  const set = {};

  if (body.label !== undefined) set.title = String(body.label).trim();
  if (body.number !== undefined) set.phone = String(body.number).trim();
  if (body.alternateNumber !== undefined) {
    set.alternatePhone = String(body.alternateNumber).trim();
  }
  if (body.description !== undefined) {
    set.description = String(body.description).trim();
  }
  if (body.availability !== undefined) set.availability = body.availability;
  if (body.isPinned !== undefined) set.isPinned = Boolean(body.isPinned);

  const icon = body.icon ?? body.category;
  if (icon !== undefined) {
    // An unrecognised icon falls back rather than failing — the app
    // offers a fixed set, but the enum here is the older one and a
    // mismatch should not lose the contact.
    set.category = HELPLINE_CATEGORIES.includes(icon) ? icon : "other";
  }

  return set;

};

exports.createHelpline = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.HELPLINE_MANAGE,
    "Only the committee can change the helpline."
  );

  const set = helplineBody(req.body);

  if (!set.title) throw new AppError("Give the contact a name.", 400);
  if (!set.phone) throw new AppError("Give the contact a number.", 400);

  const created = await Helpline.create({
    ...set,
    societyId: req.user.societyId,
  });

  return shapeHelpline(created.toObject());

};

exports.updateHelpline = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.HELPLINE_MANAGE,
    "Only the committee can change the helpline."
  );

  const set = helplineBody(req.body);

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const updated = await Helpline.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("Contact not found.", 404);

  return shapeHelpline(updated);

};

exports.deleteHelpline = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.HELPLINE_MANAGE,
    "Only the committee can change the helpline."
  );

  // Soft delete: the number may be referenced from an old notice, and
  // the list already filters on isActive.
  const updated = await Helpline.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: { isActive: false } },
    { returnDocument: "after" }
  ).lean();

  if (!updated) throw new AppError("Contact not found.", 404);

  return { removed: updated._id };

};

// =======================================================
// NEARBY SERVICES
//
// The businesses the platform has attached to this society. The
// catalogue itself is cross-tenant and managed by the salespeople —
// residents only ever see their own society's slice.
// =======================================================

exports.listNearbyServices = async (req) => {

  const rows = await SocietyService.find({
    societyId: asId(req.user.societyId),
    isVisible: { $ne: false },
  })
    .populate("serviceId")
    .sort({ isRecommended: -1, createdAt: -1 })
    .lean();

  return rows
    // A catalogue entry deleted out from under the attachment would
    // otherwise render as a blank card.
    .filter((row) => row.serviceId)
    .map((row) => ({
      _id: row._id,
      serviceId: row.serviceId._id,
      name: row.serviceId.name,
      category: row.serviceId.category,
      phone: row.serviceId.phone,
      address: row.serviceId.address,
      description: row.serviceId.description,
      image: row.serviceId.image,
      openTime: row.serviceId.openTime,
      closeTime: row.serviceId.closeTime,
      latitude: row.serviceId.latitude,
      longitude: row.serviceId.longitude,
      isRecommended: Boolean(row.isRecommended),
      isEmergency: Boolean(row.isEmergency),
      note: row.notes || "",
    }));

};

// =======================================================
// PARKING
// =======================================================

exports.getParkingSummary = async (req) => {

  const societyId = asId(req.user.societyId);

  const [slots, counts] = await Promise.all([

    ParkingSlot.find({ societyId })
      .sort({ slotNumber: 1 })
      .limit(500)
      .lean(),

    ParkingSlot.aggregate([
      { $match: { societyId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  return {
    slots,
    total: slots.length,
    free: Number(byStatus.free || 0),
    occupied: Number(byStatus.occupied || 0),
    reserved: Number(byStatus.reserved || 0),
    canManage: has(req.user, PERMISSIONS.PARKING_MANAGE),
  };

};

exports.listParkingSlots = async (req) => {

  return ParkingSlot.find({ societyId: asId(req.user.societyId) })
    .sort({ slotNumber: 1 })
    .limit(500)
    .lean();

};

exports.createParkingSlots = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.PARKING_MANAGE,
    "Only the committee can lay out parking."
  );

  const prefix = String(req.body.prefix || "").toUpperCase().trim();
  const count = Number(req.body.count);
  const type = ["resident", "visitor"].includes(req.body.type)
    ? req.body.type
    : "resident";

  if (!prefix) throw new AppError("Enter a slot prefix.", 400);

  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new AppError("Enter a count between 1 and 200.", 400);
  }

  const societyId = asId(req.user.societyId);

  const existing = await ParkingSlot.find({ societyId })
    .select("slotNumber")
    .lean();

  const taken = new Set(existing.map((s) => s.slotNumber));

  // Numbering continues past whatever already exists rather than
  // restarting at 1, so running the batch twice extends the row
  // instead of colliding with it.
  const rows = [];
  let n = 1;

  while (rows.length < count) {
    const slotNumber = `${prefix}-${String(n).padStart(3, "0")}`;
    if (!taken.has(slotNumber)) {
      rows.push({ societyId, slotNumber, type, status: "free" });
    }
    n += 1;

    // A prefix already used 200 times over would otherwise spin here.
    if (n > count + taken.size + 10) break;
  }

  const created = await ParkingSlot.insertMany(rows, { ordered: false });

  return { created: created.length, slots: created };

};

exports.updateParkingSlot = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.PARKING_MANAGE,
    "Only the committee can change parking."
  );

  const set = {};

  if (req.body.status !== undefined) {
    if (!["free", "occupied", "reserved"].includes(req.body.status)) {
      throw new AppError("Unknown slot status.", 400);
    }
    set.status = req.body.status;
  }

  if (req.body.type !== undefined) {
    if (!["resident", "visitor"].includes(req.body.type)) {
      throw new AppError("Unknown slot type.", 400);
    }
    set.type = req.body.type;
  }

  if (req.body.currentVehicleNumber !== undefined) {
    const plate = String(req.body.currentVehicleNumber || "").toUpperCase().trim();
    set.currentVehicleNumber = plate || null;
    // Freeing a slot and leaving a plate on it would show the next
    // resident someone else's car.
    if (!plate && set.status === undefined) set.status = "free";
    if (plate && set.status === undefined) set.status = "occupied";
  }

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  set.lastUpdatedAt = new Date();

  const slot = await ParkingSlot.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  if (!slot) throw new AppError("Slot not found.", 404);

  return slot;

};

exports.deleteParkingSlot = async (req) => {

  requirePermission(
    req.user, PERMISSIONS.PARKING_MANAGE,
    "Only the committee can change parking."
  );

  const slot = await ParkingSlot.findOneAndDelete({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
    // A slot with a car in it is not free to remove — the allocation
    // would vanish while the vehicle stays put.
    status: { $ne: "occupied" },
  }).lean();

  if (!slot) {
    const exists = await ParkingSlot.exists({
      _id: req.params.id,
      societyId: asId(req.user.societyId),
    });

    if (exists) throw new AppError("That slot is occupied.", 409);

    throw new AppError("Slot not found.", 404);
  }

  return { removed: slot._id };

};
