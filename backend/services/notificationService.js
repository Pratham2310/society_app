const logger = require("../utils/logger");
const Notification = require("../models/Notification");
const pushService = require("./pushService");
const { getPagination, applyPagination, buildPage } =
  require("../utils/pagination");

// =======================================================
// NOTIFICATIONS
//
// Two channels, one call:
//   - a Notification row, which is the in-app inbox the user can
//     scroll back through
//   - an Expo push, which is what actually reaches a locked phone
//
// The row is the source of truth. Push is best-effort: a visitor
// still gets logged at the gate if Expo is unreachable, and the
// resident sees it next time they open the app.
// =======================================================

// =======================================================
// NOTIFY
// =======================================================

const notify = async ({
  userIds,
  societyId,
  title,
  message,
  type = "general",
  data = {},
}) => {

  const recipients = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean);

  if (!recipients.length) {
    return { created: 0, push: { sent: 0, failed: 0 } };
  }

  const rows = recipients.map((userId) => ({
    userId,
    societyId,
    title,
    message,
    type,
  }));

  const created = await Notification.insertMany(rows, { ordered: false });

  // Never let a delivery problem fail the operation that caused it.
  let push = { sent: 0, failed: 0, invalidTokens: [] };

  try {

    push = await pushService.sendToUsers(recipients, {
      title,
      body: message,
      data: { type, ...data },
    });

  } catch (error) {

    logger.error({ err: error }, "Push dispatch failed");

  }

  return { created: created.length, push };

};

// =======================================================
// READS
// =======================================================

const list = async (user, query = {}) => {

  const filter = { userId: user.id };

  if (query.unread === "true") {
    filter.isRead = false;
  }

  const pagination = getPagination(query);

  const rows = await applyPagination(
    Notification.find(filter),
    pagination
  ).lean();

  const total = pagination.mode === "offset"
    ? await Notification.countDocuments(filter)
    : null;

  return buildPage(rows, pagination, total);

};

const unreadCount = (user) =>
  Notification.countDocuments({ userId: user.id, isRead: false });

// =======================================================
// WRITES
// =======================================================

const markRead = async (notificationId, user) => {

  // Scoped by userId so one resident cannot mark another's inbox read.
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId: user.id },
    { $set: { isRead: true } },
    { new: true }
  );

};

const markAllRead = async (user) => {

  const result = await Notification.updateMany(
    { userId: user.id, isRead: false },
    { $set: { isRead: true } }
  );

  return result.modifiedCount || 0;

};

module.exports = {
  notify,
  list,
  unreadCount,
  markRead,
  markAllRead,
};
