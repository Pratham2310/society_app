const mongoose = require("mongoose");

const Amenity = require("../models/Amenity");
const AmenityBooking = require("../models/AmenityBooking");

const notificationService = require("./notificationService");
const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");

// =======================================================
// AMENITIES
//
// Booking the clubhouse. The only interesting problem here is that two
// residents must not end up holding the same hall for the same hour,
// which is enforced by re-checking overlap inside a transaction rather
// than by trusting the check that happened when the screen loaded.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const canManage = (user) => has(user, PERMISSIONS.AMENITIES_MANAGE);

const requireManage = (user) => {
  if (!canManage(user)) {
    throw new AppError("Only the committee can change amenities.", 403);
  }
};

// "HH:MM" -> minutes past midnight. Returns null for anything that is
// not a real time, so callers reject rather than compare garbage.
const toMinutes = (value) => {

  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(String(value || "").trim());

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;

};

const fromMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const today = () => new Date().toISOString().slice(0, 10);

// =======================================================
// AMENITIES
// =======================================================

const shapeAmenity = (a, extra = {}) => ({
  _id: a._id,
  name: a.name,
  description: a.description || "",
  icon: a.icon || "sparkles",
  openTime: a.openTime,
  closeTime: a.closeTime,
  chargePerHour: a.chargePerHour || 0,
  slotDurationMinutes: a.slotDurationMinutes || 60,
  requiresApproval: Boolean(a.requiresApproval),
  isBookable: a.isBookable !== false,
  ...extra,
});

exports.listAmenities = async (req) => {

  const societyId = asId(req.user.societyId);
  const day = req.query.date && DATE_PATTERN.test(req.query.date)
    ? req.query.date
    : today();

  const amenities = await Amenity.find({ societyId })
    .sort({ name: 1 })
    .lean();

  if (!amenities.length) return [];

  // One query for every amenity's day rather than one per amenity —
  // the list screen would otherwise fan out badly on a slow phone.
  const bookings = await AmenityBooking.find({
    societyId,
    amenityId: { $in: amenities.map((a) => a._id) },
    date: day,
    status: { $in: ["pending", "confirmed"] },
  })
    .select("amenityId startMinutes endMinutes status")
    .lean();

  const byAmenity = new Map();

  for (const booking of bookings) {
    const key = String(booking.amenityId);
    if (!byAmenity.has(key)) byAmenity.set(key, []);
    byAmenity.get(key).push(booking);
  }

  const nowMinutes = (() => {
    const now = new Date();
    return day === today() ? now.getHours() * 60 + now.getMinutes() : -1;
  })();

  return amenities.map((amenity) => {

    const rows = (byAmenity.get(String(amenity._id)) || [])
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const current = nowMinutes >= 0
      ? rows.find((r) => r.startMinutes <= nowMinutes && r.endMinutes > nowMinutes)
      : undefined;

    const next = rows.find((r) => r.startMinutes > nowMinutes);

    return shapeAmenity(amenity, {
      todayCount: rows.length,
      busyNow: Boolean(current),
      busyUntil: current ? fromMinutes(current.endMinutes) : null,
      nextSlot: next ? fromMinutes(next.startMinutes) : null,
    });

  });

};

exports.getAmenity = async (req) => {

  const amenity = await Amenity.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!amenity) throw new AppError("Amenity not found.", 404);

  return shapeAmenity(amenity);

};

const amenityBody = (body) => {

  const set = {};

  if (body.name !== undefined) set.name = String(body.name).trim();
  if (body.description !== undefined) set.description = String(body.description).trim();
  if (body.icon !== undefined) set.icon = String(body.icon).trim();
  if (body.requiresApproval !== undefined) set.requiresApproval = Boolean(body.requiresApproval);
  if (body.isBookable !== undefined) set.isBookable = Boolean(body.isBookable);

  for (const field of ["openTime", "closeTime"]) {
    if (body[field] === undefined) continue;
    if (toMinutes(body[field]) === null) {
      throw new AppError(`Enter ${field === "openTime" ? "an opening" : "a closing"} time as HH:MM.`, 400);
    }
    set[field] = body[field];
  }

  if (body.chargePerHour !== undefined) {
    const charge = Number(body.chargePerHour);
    if (!Number.isFinite(charge) || charge < 0) {
      throw new AppError("Enter a valid hourly charge.", 400);
    }
    set.chargePerHour = charge;
  }

  if (body.slotDurationMinutes !== undefined) {
    const slot = Number(body.slotDurationMinutes);
    if (!Number.isInteger(slot) || slot < 15 || slot > 1440) {
      throw new AppError("A slot must be between 15 minutes and a day.", 400);
    }
    set.slotDurationMinutes = slot;
  }

  return set;

};

exports.createAmenity = async (req) => {

  requireManage(req.user);

  const set = amenityBody(req.body);

  if (!set.name) throw new AppError("Give the amenity a name.", 400);

  if (set.openTime && set.closeTime &&
      toMinutes(set.closeTime) <= toMinutes(set.openTime)) {
    throw new AppError("It has to close after it opens.", 400);
  }

  try {
    const amenity = await Amenity.create({
      ...set,
      societyId: req.user.societyId,
    });

    return shapeAmenity(amenity.toObject());

  } catch (err) {
    // The unique index on (societyId, name) is what actually prevents
    // two gyms, so the duplicate is caught here rather than by a
    // lookup that could race.
    if (err?.code === 11000) {
      throw new AppError("There is already an amenity with that name.", 409);
    }
    throw err;
  }

};

exports.updateAmenity = async (req) => {

  requireManage(req.user);

  const set = amenityBody(req.body);

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const current = await Amenity.findOne({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!current) throw new AppError("Amenity not found.", 404);

  const opens = toMinutes(set.openTime ?? current.openTime);
  const closes = toMinutes(set.closeTime ?? current.closeTime);

  if (opens !== null && closes !== null && closes <= opens) {
    throw new AppError("It has to close after it opens.", 400);
  }

  const amenity = await Amenity.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  ).lean();

  return shapeAmenity(amenity);

};

exports.deleteAmenity = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  // Somebody is holding it. Removing the amenity would leave their
  // booking pointing at nothing.
  const upcoming = await AmenityBooking.countDocuments({
    amenityId: req.params.id,
    societyId,
    status: { $in: ["pending", "confirmed"] },
    date: { $gte: today() },
  });

  if (upcoming > 0) {
    throw new AppError(
      "There are bookings for this amenity. Make it unbookable instead.",
      409
    );
  }

  const amenity = await Amenity.findOneAndDelete({
    _id: req.params.id,
    societyId,
  }).lean();

  if (!amenity) throw new AppError("Amenity not found.", 404);

  return { removed: amenity._id };

};

// =======================================================
// BOOKINGS
// =======================================================

const shapeBooking = (b, userId) => ({
  _id: b._id,
  amenityId: b.amenityId?._id || b.amenityId,
  amenityName: b.amenityId?.name,
  amenityIcon: b.amenityId?.icon,
  date: b.date,
  startTime: b.startTime,
  endTime: b.endTime,
  status: b.status,
  purpose: b.purpose || "",
  bookedBy: b.userId?.name || "Resident",
  flatNumber: b.userId?.flatNumber || "",
  isMine: String(b.userId?._id || b.userId) === String(userId),
});

exports.listAmenityBookings = async (req) => {

  const societyId = asId(req.user.societyId);

  const day = req.query.date && DATE_PATTERN.test(req.query.date)
    ? req.query.date
    : today();

  const amenity = await Amenity.findOne({ _id: req.params.id, societyId }).lean();

  if (!amenity) throw new AppError("Amenity not found.", 404);

  const rows = await AmenityBooking.find({
    amenityId: amenity._id,
    societyId,
    date: day,
    status: { $in: ["pending", "confirmed"] },
  })
    .populate("userId", "name flatNumber")
    .sort({ startMinutes: 1 })
    .lean();

  return rows.map((r) => shapeBooking(r, req.user.id));

};

exports.listMyBookings = async (req) => {

  const rows = await AmenityBooking.find({
    societyId: asId(req.user.societyId),
    userId: req.user.id,
    status: { $ne: "cancelled" },
  })
    .populate("amenityId", "name icon")
    .populate("userId", "name flatNumber")
    .sort({ date: -1, startMinutes: -1 })
    .limit(100)
    .lean();

  return rows.map((r) => shapeBooking(r, req.user.id));

};

exports.listPendingBookings = async (req) => {

  requireManage(req.user);

  const rows = await AmenityBooking.find({
    societyId: asId(req.user.societyId),
    status: "pending",
  })
    .populate("amenityId", "name icon")
    .populate("userId", "name flatNumber")
    .sort({ date: 1, startMinutes: 1 })
    .limit(100)
    .lean();

  return rows.map((r) => shapeBooking(r, req.user.id));

};

exports.createBooking = async (req) => {

  const societyId = asId(req.user.societyId);

  const amenity = await Amenity.findOne({ _id: req.params.id, societyId }).lean();

  if (!amenity) throw new AppError("Amenity not found.", 404);

  if (amenity.isBookable === false) {
    throw new AppError("That amenity is not available for booking.", 409);
  }

  const date = String(req.body.date || "").trim();

  if (!DATE_PATTERN.test(date)) {
    throw new AppError("Pick a date.", 400);
  }

  if (date < today()) {
    throw new AppError("That date has already passed.", 400);
  }

  const startMinutes = toMinutes(req.body.startTime);
  const endMinutes = toMinutes(req.body.endTime);

  if (startMinutes === null || endMinutes === null) {
    throw new AppError("Enter times as HH:MM.", 400);
  }

  if (endMinutes <= startMinutes) {
    throw new AppError("It has to end after it starts.", 400);
  }

  const opens = toMinutes(amenity.openTime);
  const closes = toMinutes(amenity.closeTime);

  if (opens !== null && startMinutes < opens) {
    throw new AppError(`It opens at ${amenity.openTime}.`, 400);
  }

  if (closes !== null && endMinutes > closes) {
    throw new AppError(`It closes at ${amenity.closeTime}.`, 400);
  }

  const status = amenity.requiresApproval ? "pending" : "confirmed";

  const session = await mongoose.startSession();

  let booking;

  try {

    await session.withTransaction(async () => {

      // Re-checked here, inside the transaction, rather than relying on
      // whatever the screen saw when it loaded. Two residents tapping
      // the same slot seconds apart both pass any earlier check.
      //
      // Overlap is "starts before the other ends AND ends after the
      // other starts" — touching at the boundary is not an overlap, so
      // 09:00-10:00 and 10:00-11:00 both stand.
      const clash = await AmenityBooking.findOne({
        amenityId: amenity._id,
        societyId,
        date,
        status: { $in: ["pending", "confirmed"] },
        startMinutes: { $lt: endMinutes },
        endMinutes: { $gt: startMinutes },
      }).session(session).lean();

      if (clash) {
        throw new AppError(
          `Already booked from ${clash.startTime} to ${clash.endTime}.`,
          409
        );
      }

      const created = await AmenityBooking.create([{
        societyId,
        amenityId: amenity._id,
        userId: req.user.id,
        date,
        startTime: fromMinutes(startMinutes),
        endTime: fromMinutes(endMinutes),
        startMinutes,
        endMinutes,
        purpose: String(req.body.purpose || "").trim(),
        status,
      }], { session });

      booking = created[0];

    });

  } finally {
    await session.endSession();
  }

  return {
    ...shapeBooking(booking.toObject(), req.user.id),
    amenityName: amenity.name,
    amenityIcon: amenity.icon,
  };

};

exports.decideBooking = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const raw = req.body?.status ?? (req.body?.approved === true ? "confirmed" : undefined);

  const decision = raw === "confirmed" || raw === "approved"
    ? "confirmed"
    : raw === "rejected" || req.body?.approved === false
      ? "rejected"
      : null;

  if (!decision) throw new AppError("Say whether the booking is approved.", 400);

  const booking = await AmenityBooking.findOne({
    _id: req.params.bookingId,
    societyId,
    status: "pending",
  }).lean();

  if (!booking) throw new AppError("No pending booking with that id.", 404);

  // Approving one that now clashes would double-book the hall. Two
  // pending requests for the same slot can both be waiting here.
  if (decision === "confirmed") {

    const clash = await AmenityBooking.findOne({
      _id: { $ne: booking._id },
      amenityId: booking.amenityId,
      societyId,
      date: booking.date,
      status: "confirmed",
      startMinutes: { $lt: booking.endMinutes },
      endMinutes: { $gt: booking.startMinutes },
    }).lean();

    if (clash) {
      throw new AppError(
        `That slot was already given to the booking from ${clash.startTime} to ${clash.endTime}.`,
        409
      );
    }

  }

  const updated = await AmenityBooking.findOneAndUpdate(
    { _id: booking._id, societyId, status: "pending" },
    {
      $set: {
        status: decision,
        decidedBy: req.user.id,
        decidedAt: new Date(),
        rejectionReason: decision === "rejected"
          ? String(req.body.reason || "").trim() || null
          : null,
      },
    },
    { returnDocument: "after" }
  )
    .populate("amenityId", "name icon")
    .populate("userId", "name flatNumber")
    .lean();

  if (!updated) throw new AppError("That booking was already decided.", 409);

  try {
    await notificationService.notify({
      userIds: [updated.userId?._id || updated.userId],
      societyId,
      title: decision === "confirmed" ? "Booking confirmed" : "Booking declined",
      message: `${updated.amenityId?.name || "The amenity"} on ${updated.date}, ${updated.startTime}–${updated.endTime}.`,
      type: "general",
      data: { bookingId: String(updated._id) },
    });
  } catch { /* best effort */ }

  return shapeBooking(updated, req.user.id);

};

exports.cancelBooking = async (req) => {

  const societyId = asId(req.user.societyId);

  const booking = await AmenityBooking.findOne({
    _id: req.params.bookingId,
    societyId,
  }).lean();

  if (!booking) throw new AppError("Booking not found.", 404);

  const mine = String(booking.userId) === String(req.user.id);

  if (!mine && !canManage(req.user)) {
    throw new AppError("That booking is not yours.", 403);
  }

  if (booking.status === "cancelled") {
    throw new AppError("That booking is already cancelled.", 409);
  }

  await AmenityBooking.updateOne(
    { _id: booking._id, societyId },
    { $set: { status: "cancelled", decidedBy: req.user.id, decidedAt: new Date() } }
  );

  return { cancelled: booking._id };

};
