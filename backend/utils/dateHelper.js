// =======================================================
// START OF DAY
// =======================================================

const getStartOfDay = (date = new Date()) => {
  const start = new Date(date);

  start.setHours(0, 0, 0, 0);

  return start;
};

// =======================================================
// END OF DAY
// =======================================================

const getEndOfDay = (date = new Date()) => {
  const end = new Date(date);

  end.setHours(23, 59, 59, 999);

  return end;
};

// =======================================================
// START OF WEEK
// =======================================================

const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);

  const day = d.getDay();

  const diff = d.getDate() - day;

  d.setDate(diff);

  d.setHours(0, 0, 0, 0);

  return d;
};

// =======================================================
// END OF WEEK
// =======================================================

const getEndOfWeek = (date = new Date()) => {
  const end = new Date(getStartOfWeek(date));

  end.setDate(end.getDate() + 6);

  end.setHours(23, 59, 59, 999);

  return end;
};

// =======================================================
// START OF MONTH
// =======================================================

const getStartOfMonth = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
};

// =======================================================
// END OF MONTH
// =======================================================

const getEndOfMonth = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
};

// =======================================================
// START OF YEAR
// =======================================================

const getStartOfYear = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0
  );
};

// =======================================================
// END OF YEAR
// =======================================================

const getEndOfYear = (date = new Date()) => {
  return new Date(
    date.getFullYear(),
    11,
    31,
    23,
    59,
    59,
    999
  );
};

// =======================================================
// ADD DAYS
// =======================================================

const addDays = (
  date,
  days
) => {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
};

// =======================================================
// IS SAME DAY
// =======================================================

const isSameDay = (
  firstDate,
  secondDate
) => {

  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );

};

// =======================================================
// FORMAT DATE
// YYYY-MM-DD
// =======================================================

const formatDate = (
  date = new Date()
) => {

  return date
    .toISOString()
    .split("T")[0];

};

// =======================================================
// EXPORTS
// =======================================================

module.exports = {

  getStartOfDay,

  getEndOfDay,

  getStartOfWeek,

  getEndOfWeek,

  getStartOfMonth,

  getEndOfMonth,

  getStartOfYear,

  getEndOfYear,

  addDays,

  isSameDay,

  formatDate,

};