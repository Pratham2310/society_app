const mongoose = require("mongoose");

const Service = require("../models/Service");
const SocietyMapItem = require("../models/SocietyMapItem");

const AppError = require("../utils/appError");
const { PERMISSIONS, has } = require("../config/permissions");

// =======================================================
// SOCIETY MAP
//
// Pins on the society's layout. The catalogue behind them is shared
// across societies and maintained by the platform; what a society owns
// is where each one sits and what it is called locally.
// =======================================================

const asId = (v) => new mongoose.Types.ObjectId(String(v));

const requireManage = (user) => {
  if (!has(user, PERMISSIONS.MAP_MANAGE)) {
    throw new AppError("Only the committee can change the map.", 403);
  }
};

const shapeItem = (item) => ({
  _id: item._id,
  serviceId: item.serviceId?._id || item.serviceId,
  // The local name wins where one was set, otherwise the catalogue's.
  name: item.customName || item.serviceId?.name || "Service",
  customName: item.customName || "",
  category: item.serviceId?.category,
  phone: item.serviceId?.phone,
  address: item.serviceId?.address,
  image: item.serviceId?.image,
  openTime: item.serviceId?.openTime,
  closeTime: item.serviceId?.closeTime,
  mapPosition: item.mapPosition || { x: 50, y: 50 },
  status: item.status,
  notes: item.notes || "",
});

const clamp = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  // The plan is addressed in percentages; anything outside it would
  // render off the edge of the image.
  return Math.max(0, Math.min(100, n));
};

exports.listMap = async (req) => {

  const rows = await SocietyMapItem.find({ societyId: asId(req.user.societyId) })
    .populate("serviceId")
    .sort({ createdAt: 1 })
    .lean();

  // A catalogue entry deleted out from under a pin would otherwise
  // render as an unnamed marker in the middle of the plan.
  return rows.filter((r) => r.serviceId).map(shapeItem);

};

exports.getCatalog = async (req) => {

  // What is available to pin. Cross-tenant by design — the catalogue
  // is the platform's, not this society's — so it is read without a
  // society filter and carries nothing society-specific.
  const services = await Service.find({ isActive: { $ne: false } })
    .select("name category phone address image openTime closeTime")
    .sort({ category: 1, name: 1 })
    .limit(500)
    .lean();

  const placed = await SocietyMapItem.find({ societyId: asId(req.user.societyId) })
    .select("serviceId")
    .lean();

  const already = new Set(placed.map((p) => String(p.serviceId)));

  return services.map((s) => ({
    ...s,
    isPlaced: already.has(String(s._id)),
  }));

};

exports.addMapItem = async (req) => {

  requireManage(req.user);

  const societyId = asId(req.user.societyId);

  const service = await Service.findById(req.body.serviceId).lean();

  if (!service) throw new AppError("That service is not in the catalogue.", 404);

  const item = await SocietyMapItem.create({
    societyId,
    serviceId: service._id,
    customName: String(req.body.customName || "").trim(),
    mapPosition: {
      x: clamp(req.body.mapPosition?.x, 50),
      y: clamp(req.body.mapPosition?.y, 50),
    },
    notes: String(req.body.notes || "").trim(),
  });

  return shapeItem({ ...item.toObject(), serviceId: service });

};

exports.updateMapItem = async (req) => {

  requireManage(req.user);

  const set = {};

  if (req.body.customName !== undefined) {
    set.customName = String(req.body.customName).trim();
  }

  if (req.body.notes !== undefined) {
    set.notes = String(req.body.notes).trim();
  }

  if (req.body.status !== undefined) {
    const allowed = ["open", "closed", "temporarily_closed"];
    if (!allowed.includes(req.body.status)) {
      throw new AppError("Unknown status.", 400);
    }
    set.status = req.body.status;
  }

  if (req.body.mapPosition !== undefined) {
    set.mapPosition = {
      x: clamp(req.body.mapPosition?.x, 50),
      y: clamp(req.body.mapPosition?.y, 50),
    };
  }

  if (!Object.keys(set).length) throw new AppError("Nothing was changed.", 400);

  const item = await SocietyMapItem.findOneAndUpdate(
    { _id: req.params.id, societyId: asId(req.user.societyId) },
    { $set: set },
    { returnDocument: "after" }
  )
    .populate("serviceId")
    .lean();

  if (!item) throw new AppError("Map item not found.", 404);

  return shapeItem(item);

};

exports.deleteMapItem = async (req) => {

  requireManage(req.user);

  const item = await SocietyMapItem.findOneAndDelete({
    _id: req.params.id,
    societyId: asId(req.user.societyId),
  }).lean();

  if (!item) throw new AppError("Map item not found.", 404);

  // Only the pin goes. The catalogue entry belongs to the platform and
  // other societies are still using it.
  return { removed: item._id };

};
