// =======================================================
// RESPONSE ENVELOPE
//
// Three clients consume this API and the controllers returned at
// least six different shapes: { success, data }, { message, data },
// { token, user }, bare arrays, and two typos ({ succes }, { messsage }).
//
// Normalising centrally rather than editing ~150 call sites means the
// contract is guaranteed rather than merely intended, and a new
// controller cannot drift from it.
//
// Canonical shape, for every response:
//
//   { success: boolean, message: string, data: any }
//
// Paginated lists add a sibling `meta`.
// =======================================================

// A response must never carry an unbounded collection. This is a
// wire-level backstop, deliberately separate from database
// pagination: capping at the query layer would also truncate
// internal batch reads (bill generation iterates every member),
// which would silently under-bill a large society.
//
// Endpoints with real pagination set their own meta and are left
// alone. Anything else gets capped and told the truth about it.
const { MAX_LIMIT } = require("../utils/pagination");

const capCollection = (data, existingMeta) => {

  if (!Array.isArray(data) || data.length <= MAX_LIMIT) {
    return { data, meta: existingMeta };
  }

  return {
    data: data.slice(0, MAX_LIMIT),
    meta: {
      ...(existingMeta || {}),
      limit: MAX_LIMIT,
      truncated: true,
      hasMore: true,
      returned: MAX_LIMIT,
      note: "Response was capped. Use ?page= or ?cursor= to page through the full set.",
    },
  };

};

const ALREADY_CANONICAL = (payload) =>
  payload !== null &&
  typeof payload === "object" &&
  !Array.isArray(payload) &&
  "success" in payload &&
  "message" in payload &&
  "data" in payload;

// Keys that carry a human-readable message rather than data.
const MESSAGE_KEYS = ["message", "messsage", "error"];
const SUCCESS_KEYS = ["success", "succes"];

module.exports = (req, res, next) => {

  const sendJson = res.json.bind(res);

  res.json = (payload) => {

    if (ALREADY_CANONICAL(payload)) {

      const capped = capCollection(payload.data, payload.meta);

      return sendJson(
        capped.meta === undefined
          ? { ...payload, data: capped.data }
          : { ...payload, data: capped.data, meta: capped.meta }
      );

    }

    const ok = res.statusCode < 400;

    // Arrays and primitives are the whole payload.
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {

      const capped = capCollection(payload ?? null, undefined);

      const body = {
        success: ok,
        message: ok ? "Success" : "Request failed",
        data: capped.data ?? null,
      };

      if (capped.meta !== undefined) {
        body.meta = capped.meta;
      }

      return sendJson(body);

    }

    const source = { ...payload };

    let message = null;
    for (const key of MESSAGE_KEYS) {
      if (typeof source[key] === "string") {
        message = source[key];
        delete source[key];
        break;
      }
    }

    let success = ok;
    for (const key of SUCCESS_KEYS) {
      if (typeof source[key] === "boolean") {
        success = source[key];
        delete source[key];
        break;
      }
    }

    // Pagination metadata travels alongside data, not inside it.
    const meta = source.meta;
    delete source.meta;

    // An explicit `data` key wins; otherwise whatever remains is the data.
    let data;
    if ("data" in source) {
      data = source.data;
    } else {
      const keys = Object.keys(source);
      data = keys.length === 0 ? null : source;
    }

    const capped = capCollection(data, meta);

    const body = {
      success,
      message: message ?? (success ? "Success" : "Request failed"),
      data: capped.data ?? null,
    };

    if (capped.meta !== undefined) {
      body.meta = capped.meta;
    }

    return sendJson(body);

  };

  next();

};
