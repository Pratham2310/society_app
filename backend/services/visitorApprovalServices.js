const visitorApprovalRepository = require("../repository/visitorApprovalRepository");

const guestPassService = require("./guestPassService");

const {
  requestApprovalBodySchema,
  approveRequestBodySchema,
  rejectRequestBodySchema,
  cancelRequestBodySchema,
} = require("../validation/visitorApprovalValidation");

const {
  validate,
} = require("../utils/validationHelper");

const {
  startTransaction,
  commitTransaction,
  abortTransaction,
} = require("../utils/transactionHelper");

const AppError = require("../utils/appError");


// =======================================================
// PRIVATE
// CALCULATE EXPIRY
// =======================================================

const calculateExpiry = () => {

  const expiresAt = new Date();

  expiresAt.setMinutes(
    expiresAt.getMinutes() + 30
  );

  return expiresAt;

};


// =======================================================
// PRIVATE
// VALIDATE PENDING APPROVAL
// =======================================================

const validatePendingApproval = (
  approval
) => {

  if (!approval) {

    throw new AppError(
      "Approval request not found.",
      404
    );

  }

  if (
    approval.approvalStatus !== "pending"
  ) {

    throw new AppError(
      "Approval request is no longer pending.",
      400
    );

  }

};


// =======================================================
// PRIVATE
// GET VALIDATED APPROVAL
// =======================================================

const getValidatedApproval = async (
  approvalId,
  societyId
) => {

  const approval =
    await visitorApprovalRepository.findById(
      approvalId,
      societyId
    );

  validatePendingApproval(
    approval
  );

  return approval;

};

// =======================================================
// PRIVATE
// BUILD APPROVAL REQUEST
// =======================================================

const buildApprovalRequest = (
  body,
  guard
) => {

  return {

    societyId: guard.societyId,

    residentId: body.residentId,

    flatId: body.flatId,

    wingId: body.wingId,

    guardId: guard.id,

    visitorName: body.visitorName,

    visitorPhone: body.visitorPhone,

    visitorPhoto: body.visitorPhoto,

    vehicleNumber: body.vehicleNumber,

    purpose: body.purpose,

    numberOfVisitors:
      body.numberOfVisitors,

    expiresAt:
      calculateExpiry(),

    createdBy: guard.id,

  };

};


// =======================================================
// REQUEST APPROVAL
// =======================================================

const requestApproval = async (
  body,
  guard
) => {

  // Validate Request

  const validatedBody = validate(
    requestApprovalBodySchema,
    body
  );

  // Prevent duplicate pending request

  const alreadyPending =
    await visitorApprovalRepository.existsPending(

      validatedBody.residentId,

      validatedBody.visitorPhone,

      guard.societyId

    );

  if (alreadyPending) {

    throw new AppError(
      "A pending approval request already exists for this visitor.",
      409
    );

  }

  // Build Data

  const approvalData =
    buildApprovalRequest(
      validatedBody,
      guard
    );

  // Save

  return visitorApprovalRepository.create(
    approvalData
  );

};


// =======================================================
// APPROVE REQUEST
// =======================================================

const approveRequest = async (
  body,
  resident
) => {

  const validatedBody = validate(
    approveRequestBodySchema,
    body
  );

  const approval =
    await getValidatedApproval(
      validatedBody.approvalId,
      resident.societyId
    );

  let session;

  try {

    session =
      await startTransaction();

    // Create Guest Pass
    const guestPass =
      await guestPassService.createGuestPassFromApproval(
        approval,
        resident,
        session
      );

    // Attach Guest Pass
    await visitorApprovalRepository.attachGuestPass(
      approval._id,
      resident.societyId,
      guestPass._id,
      session
    );

    // Mark Approved
    const updatedApproval =
      await visitorApprovalRepository.approve(
        approval._id,
        resident.societyId,
        resident.id,
        session
      );

    await commitTransaction(session);

    return updatedApproval;

  }

  catch (error) {

    if (session) {

      await abortTransaction(
        session
      );

    }

    throw error;

  }

};



// =======================================================
// REJECT REQUEST
// =======================================================

const rejectRequest = async (
  body,
  resident
) => {

  const validatedBody = validate(
    rejectRequestBodySchema,
    body
  );

  const approval =
    await getValidatedApproval(
      validatedBody.approvalId,
      resident.societyId
    );

  return visitorApprovalRepository.reject(
    approval._id,
    resident.societyId,
    resident.id,
    validatedBody.rejectionReason
  );

};



// =======================================================
// CANCEL REQUEST
// =======================================================

const cancelRequest = async (
  body,
  guard
) => {

  const validatedBody = validate(
    cancelRequestBodySchema,
    body
  );

  const approval =
    await getValidatedApproval(
      validatedBody.approvalId,
      guard.societyId
    );

  return visitorApprovalRepository.cancel(
    approval._id,
    guard.societyId
  );

};


// =======================================================
// GET APPROVAL BY ID
// =======================================================

const getApprovalById = async (
  approvalId,
  user
) => {

  const approval =
    await visitorApprovalRepository.findById(
      approvalId,
      user.societyId
    );

  if (!approval) {

    throw new AppError(
      "Approval request not found.",
      404
    );

  }

  return approval;

};



// =======================================================
// RESIDENT PENDING REQUESTS
// =======================================================

const getResidentPendingRequests = async (
  resident,
  options = {}
) => {

  return visitorApprovalRepository.findResidentPending(
    resident.id,
    resident.societyId,
    options
  );

};


// =======================================================
// GUARD PENDING REQUESTS
// =======================================================

const getGuardPendingRequests = async (
  guard,
  options = {}
) => {

  return visitorApprovalRepository.findGuardPending(
    guard.id,
    guard.societyId,
    options
  );

};  


// =======================================================
// APPROVAL STATISTICS
// =======================================================

const getApprovalStatistics = async (
  societyId
) => {

  const [

    total,

    pending,

    approved,

    rejected,

    expired,

  ] = await Promise.all([

    visitorApprovalRepository.countTotal(
      societyId
    ),

    visitorApprovalRepository.countPending(
      societyId
    ),

    visitorApprovalRepository.countApproved(
      societyId
    ),

    visitorApprovalRepository.countRejected(
      societyId
    ),

    visitorApprovalRepository.countExpired(
      societyId
    ),

  ]);

  return {

    total,

    pending,

    approved,

    rejected,

    expired,

  };

};


module.exports = {

  requestApproval,

  approveRequest,

  rejectRequest,

  cancelRequest,

  getApprovalById,

  getResidentPendingRequests,

  getGuardPendingRequests,

  getApprovalStatistics,

};
