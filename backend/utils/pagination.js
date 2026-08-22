const mongoose = require("mongoose");

// =======================================================
// PAGINATION
//
// Two clients want different things from the same endpoints:
//
//   Expo lists scroll infinitely  -> cursor pagination, which stays
//     correct while new rows arrive at the head of the list.
//   Web console tables are paged  -> offset pagination, which can
//     jump to page 7 and show a total count.
//
// Both are supported on every list endpoint. The hard cap matters
// more than the style: before this, several endpoints returned every
// row a society had.
// =======================================================

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (value) => {

  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);

};

// Read pagination intent off a request without trusting any of it.
const getPagination = (query = {}) => {

  const limit = parseLimit(query.limit);

  const hasCursorValue =
    typeof query.cursor === "string" &&
    mongoose.Types.ObjectId.isValid(query.cursor);

  // A client must be able to START cursor paging, which means asking
  // for the mode before it holds a cursor. `?mode=cursor` opens the
  // sequence; every page after that carries the cursor itself.
  const wantsCursor = query.mode === "cursor" || hasCursorValue;

  // Cursor mode ignores page entirely — mixing them is meaningless.
  if (wantsCursor) {
    return {
      mode: "cursor",
      cursor: hasCursorValue ? query.cursor : null,
      limit,
      page: null,
      skip: 0,
    };
  }

  const parsedPage = Number.parseInt(query.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return {
    mode: "offset",
    cursor: null,
    limit,
    page,
    skip: (page - 1) * limit,
  };

};

// Apply pagination to a mongoose query. Cursor paging walks _id
// descending, which matches "newest first" for ObjectIds.
const applyPagination = (mongooseQuery, pagination) => {

  if (pagination.mode === "cursor") {

    // The first page of a cursor sequence has no cursor yet.
    if (pagination.cursor) {
      mongooseQuery = mongooseQuery.where({ _id: { $lt: pagination.cursor } });
    }

    return mongooseQuery
      .sort({ _id: -1 })
      .limit(pagination.limit + 1);

  }

  return mongooseQuery
    .sort({ _id: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit + 1);

};

// Split the over-fetched row back off and describe the page.
// Fetching limit+1 is how we know whether more exists without a
// second count query on the hot path.
const buildPage = (rows, pagination, total = null) => {

  const hasMore = rows.length > pagination.limit;
  const items = hasMore ? rows.slice(0, pagination.limit) : rows;

  const meta = {
    limit: pagination.limit,
    hasMore,
  };

  if (pagination.mode === "cursor") {
    meta.nextCursor = hasMore ? String(items[items.length - 1]._id) : null;
  } else {
    meta.page = pagination.page;
    if (total !== null) {
      meta.total = total;
      meta.totalPages = Math.ceil(total / pagination.limit);
    }
  }

  return { items, meta };

};

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getPagination,
  applyPagination,
  buildPage,
};
