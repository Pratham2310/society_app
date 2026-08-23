const logger = require("../utils/logger");
const User = require("../models/User");

// =======================================================
// EXPO PUSH
//
// Expo's push service is free and unlimited, and it fronts both
// APNs and FCM, so the backend never talks to Apple or Google
// directly. Upload FCM and APNs credentials to EAS before the
// first production build or delivery silently fails.
//
// Nothing here throws into a request path: a resident's visitor
// must still be recorded at the gate even if a push fails.
// =======================================================

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo accepts at most 100 messages per request.
const BATCH_SIZE = 100;

const isExpoToken = (token) =>
  typeof token === "string" &&
  /^ExponentPushToken\[[^\]]+\]$/.test(token.trim());

const chunk = (items, size) => {

  const out = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;

};

// =======================================================
// SEND
// Returns a summary rather than throwing, so callers can log
// delivery problems without failing the operation that triggered
// the notification.
// =======================================================

const sendToTokens = async (tokens, { title, body, data = {} }) => {

  const valid = [...new Set(tokens.filter(isExpoToken))];

  if (!valid.length) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (const batch of chunk(valid, BATCH_SIZE)) {

    const messages = batch.map((to) => ({
      to,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
    }));

    try {

      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        failed += batch.length;
        continue;
      }

      const payload = await response.json();
      const receipts = Array.isArray(payload.data) ? payload.data : [];

      receipts.forEach((receipt, index) => {

        if (receipt.status === "ok") {
          sent += 1;
          return;
        }

        failed += 1;

        // Expo reports a token that no longer belongs to an install.
        // Keeping it means pushing into the void forever.
        if (receipt.details?.error === "DeviceNotRegistered") {
          invalidTokens.push(batch[index]);
        }

      });

    } catch (error) {

      failed += batch.length;

      logger.error({ err: error }, "Push batch failed");

    }

  }

  if (invalidTokens.length) {
    await pruneTokens(invalidTokens);
  }

  return { sent, failed, invalidTokens };

};

// =======================================================
// PRUNE
// Drop tokens Expo told us are dead, from whichever user holds them.
// =======================================================

const pruneTokens = async (tokens) => {

  if (!tokens.length) {
    return 0;
  }

  const result = await User.updateMany(
    { "pushTokens.token": { $in: tokens } },
    { $pull: { pushTokens: { token: { $in: tokens } } } }
  );

  return result.modifiedCount || 0;

};

// =======================================================
// SEND TO USERS
// =======================================================

const sendToUsers = async (userIds, message) => {

  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);

  if (!ids.length) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const users = await User.find({ _id: { $in: ids } })
    .select("pushTokens")
    .lean();

  const tokens = users.flatMap((user) =>
    (user.pushTokens || []).map((entry) => entry.token)
  );

  return sendToTokens(tokens, message);

};

// =======================================================
// REGISTER / UNREGISTER A DEVICE
// =======================================================

const registerToken = async (userId, { token, platform, deviceId }) => {

  if (!isExpoToken(token)) {
    return false;
  }

  // A device that changes hands must not keep pushing to the previous
  // occupant — guards share handsets across shifts.
  await User.updateMany(
    { _id: { $ne: userId }, "pushTokens.token": token },
    { $pull: { pushTokens: { token } } }
  );

  // Replace any existing entry for this token, then add the fresh one.
  await User.updateOne(
    { _id: userId },
    { $pull: { pushTokens: { token } } }
  );

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        pushTokens: {
          token,
          platform,
          deviceId,
          updatedAt: new Date(),
        },
      },
    }
  );

  return true;

};

const unregisterToken = async (userId, token) => {

  const result = await User.updateOne(
    { _id: userId },
    { $pull: { pushTokens: { token } } }
  );

  return (result.modifiedCount || 0) > 0;

};

module.exports = {
  sendToTokens,
  sendToUsers,
  registerToken,
  unregisterToken,
  pruneTokens,
  isExpoToken,
  BATCH_SIZE,
};
