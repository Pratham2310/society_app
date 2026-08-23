const VisitorApproval = require("../models/VisitorApproval");

// =======================================================
// VISITOR APPROVAL REPOSITORY
//
// This file previously opened with a verbatim copy of the
// VisitorApproval schema and ended with
// `module.exports = mongoose.model(...)`, which replaced the
// exports object. The service therefore imported a Mongoose
// model rather than this repository: calls to findById and
// create silently resolved to model statics with different
// semantics (no societyId scoping, no session), and every other
// method was undefined.
// =======================================================


// =======================================================
// PRIVATE HELPERS
// =======================================================

// Every lookup is scoped by societyId as well as _id, so an id
// from another society simply does not match.
const buildFilter = (id, societyId) => ({
  _id: id,
  societyId,
});

// Return the updated document, and enlist in a transaction when
// the caller is running one.
const applyUpdateOptions = (session = null) => ({
  new: true,
  ...(session ? { session } : {}),
});


// =======================================================
// CREATE
// =======================================================

exports.create = (data, session = null) => {

  if (session) {
    return VisitorApproval.create([data], { session })
      .then((docs) => docs[0]);
  }

  return VisitorApproval.create(data);

};


// =======================================================
// READS
// =======================================================

exports.findById = (id, societyId) => {

  return VisitorApproval.findOne(
    buildFilter(id, societyId)
  );

};

exports.findResidentPending = (residentId, societyId, options = {}) => {

  const { page = 1, limit = 20 } = options;

  return VisitorApproval.find({
    residentId,
    societyId,
    approvalStatus: "pending",
  })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Math.min(Number(limit), 100));

};

exports.findGuardPending = (guardId, societyId, options = {}) => {

  const { page = 1, limit = 20 } = options;

  return VisitorApproval.find({
    guardId,
    societyId,
    approvalStatus: "pending",
  })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Math.min(Number(limit), 100));

};


// =======================================================
// PRIVATE HELPERS
// =======================================================

// --------------------------------------
// Count By Status
// --------------------------------------

const countByStatus = (
  societyId,
  approvalStatus
) => {

  return VisitorApproval.countDocuments({

    societyId,

    approvalStatus,

  });

};

// =======================================================
// WORKFLOW UPDATES
// =======================================================

// --------------------------------------
// Approve
// --------------------------------------

exports.approve = (
  id,
  societyId,
  respondedBy,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        approvalStatus: "approved",

        respondedBy,

        respondedAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};

// --------------------------------------
// Reject
// --------------------------------------

exports.reject = (
  id,
  societyId,
  respondedBy,
  rejectionReason,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        approvalStatus: "rejected",

        respondedBy,

        rejectionReason,

        respondedAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};

// --------------------------------------
// Expire
// --------------------------------------

exports.expire = (
  id,
  societyId,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        approvalStatus: "expired",

      },

    },

    applyUpdateOptions(session)

  );

};

// --------------------------------------
// Cancel
// --------------------------------------

exports.cancel = (
  id,
  societyId,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        approvalStatus: "cancelled",

      },

    },

    applyUpdateOptions(session)

  );

};

// --------------------------------------
// Attach Guest Pass
// --------------------------------------

exports.attachGuestPass = (
  id,
  societyId,
  guestPassId,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        guestPassId,

      },

    },

    applyUpdateOptions(session)

  );

};

// --------------------------------------
// Update Notification Time
// --------------------------------------

exports.updateNotificationTime = (
  id,
  societyId,
  session = null
) => {

  return VisitorApproval.findOneAndUpdate(

    buildFilter(
      id,
      societyId
    ),

    {

      $set: {

        notificationSentAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};

// =======================================================
// REPORTS
// =======================================================

// --------------------------------------
// Count Pending
// --------------------------------------

exports.countPending = (
  societyId
) => {

  return countByStatus(
    societyId,
    "pending"
  );

};

// --------------------------------------
// Count Approved
// --------------------------------------

exports.countApproved = (
  societyId
) => {

  return countByStatus(
    societyId,
    "approved"
  );

};

// --------------------------------------
// Count Rejected
// --------------------------------------

exports.countRejected = (
  societyId
) => {

  return countByStatus(
    societyId,
    "rejected"
  );

};

// --------------------------------------
// Count Expired
// --------------------------------------

exports.countExpired = (
  societyId
) => {

  return countByStatus(
    societyId,
    "expired"
  );

};

// --------------------------------------
// Count Total
// --------------------------------------

exports.countTotal = (
  societyId
) => {

  return VisitorApproval.countDocuments({

    societyId,

  });

};

// =======================================================
// UTILITIES
// =======================================================

// --------------------------------------
// Exists
// --------------------------------------

exports.exists = (
  id,
  societyId
) => {

  return VisitorApproval.exists(

    buildFilter(
      id,
      societyId
    )

  );

};

// --------------------------------------
// Exists Pending
// --------------------------------------

exports.existsPending = (
  residentId,
  visitorPhone,
  societyId
) => {

  return VisitorApproval.exists({

    residentId,

    visitorPhone,

    societyId,

    approvalStatus: "pending",

  });

};