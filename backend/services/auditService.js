const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

// =======================================================
// AUDIT
//
// Recording an action must never break the action. A failure to
// write the audit row is logged loudly but swallowed — refusing a
// resident's payment because the audit collection hiccupped would
// be worse than the gap in the record.
// =======================================================

const ACTIONS = {
  PAYMENT_RECORDED: "payment.recorded",
  BILLS_GENERATED: "maintenance.bills_generated",
  BILL_MARKED_PAID: "maintenance.bill_marked_paid",
  CONTRIBUTION_APPROVED: "fund.contribution_approved",
  USER_STATUS_CHANGED: "user.status_changed",
  USER_ROLE_CHANGED: "user.role_changed",
  VISITOR_APPROVED: "visitor.approved",
  VISITOR_REJECTED: "visitor.rejected",
  GUEST_PASS_APPROVED: "guest_pass.approved",
  SALESPERSON_CREATED: "admin.salesperson_created",
  SUPERADMIN_BOOTSTRAPPED: "admin.superadmin_bootstrapped",
};

// =======================================================
// RECORD
// `actor` is req.user; `req` is optional and only used to tie the
// entry back to the request logs.
// =======================================================

const record = async (
  actor,
  action,
  { targetType, targetId, metadata = {}, req } = {}
) => {

  try {

    await AuditLog.create({
      societyId: actor?.societyId || null,
      actorId: actor?.id,
      actorRole: actor?.societyRole || actor?.systemRole,
      action,
      targetType,
      targetId,
      metadata,
      requestId: req?.id,
      ip: req?.ip,
    });

  } catch (error) {

    logger.error(
      { err: error, action, actorId: actor?.id },
      "Failed to write audit entry"
    );

  }

};

// =======================================================
// READ
// Scoped by society; the tenant plugin constrains it further.
// =======================================================

const list = async (filter = {}, pagination) => {

  const { applyPagination } = require("../utils/pagination");

  const query = {};

  if (filter.action) query.action = filter.action;
  if (filter.actorId) query.actorId = filter.actorId;
  if (filter.targetId) query.targetId = filter.targetId;

  return applyPagination(AuditLog.find(query), pagination).lean();

};

module.exports = { record, list, ACTIONS };
