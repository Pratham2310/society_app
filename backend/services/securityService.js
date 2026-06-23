const repo = require("../repository/securityRepository");
const mongoose = require("mongoose");
const staffAttendance=require("../models/StaffAttendance");


// ================= GET STATUS =================
exports.getMyStatus = async (req) => {

  let status = await repo.getStatus(req.user.id);

  // first time user
  if (!status) {

    status = await repo.createStatus({
      societyId: new mongoose.Types.ObjectId(
        req.user.societyId
      ),

      residentId: req.user.id
    });
  }

  return status;
};


// ================= UPDATE STATUS =================
exports.updateStatus = async (req) => {

  const existing =
    await repo.getStatus(req.user.id);

  // first-time creation
  if (!existing) {

    return await repo.createStatus({
      societyId: new mongoose.Types.ObjectId(
        req.user.societyId
      ),

      residentId: req.user.id,

      ...req.body
    });
  }

  // update existing
  return await repo.updateStatus(
    req.user.id,
    req.body
  );
};

// ================= CREATE VISITOR REQUEST =================
exports.createVisitorRequest = async (req) => {

  return await repo.createVisitorRequest({

    societyId: new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    residentId: req.user.id,

    visitorName: req.body.visitorName,

    purpose: req.body.purpose,

    visitorPhoto: req.body.visitorPhoto || null,

    vehicleNumber: req.body.vehicleNumber || null,

    vehiclePhoto: req.body.vehiclePhoto || null,

    messageToGuard:
      req.body.messageToGuard || ""
  });
};



// ================= GET VISITOR REQUESTS =================
exports.getVisitorRequests = async (req) => {

  return await repo.getVisitorRequests(
    req.user.id
  );
};



// ================= APPROVE VISITOR =================
exports.approveVisitor = async (id) => {

  const visitor =
    await repo.getVisitorById(id);

  if (!visitor) {
    throw new Error("Visitor not found");
  }

  return await repo.updateVisitor(id, {
    status: "approved",
    approvedAt: new Date()
  });
};



// ================= REJECT VISITOR =================
exports.rejectVisitor = async (id) => {

  const visitor =
    await repo.getVisitorById(id);

  if (!visitor) {
    throw new Error("Visitor not found");
  }

  return await repo.updateVisitor(id, {
    status: "rejected",
    rejectedAt: new Date()
  });
};



// ================= REPORT FRAUD =================
exports.reportFraud = async (id) => {

  const visitor =
    await repo.getVisitorById(id);

  if (!visitor) {
    throw new Error("Visitor not found");
  }

  return await repo.updateVisitor(id, {
    status: "fraud_reported",
    fraudReported: true
  });
};


// ================= ADD STAFF =================
exports.addStaff = async (req) => {

  // create profile
  const profile =
    await repo.createStaffProfile({

      societyId: new mongoose.Types.ObjectId(
        req.user.societyId
      ),

      name: req.body.name,

      phone: req.body.phone,

      role: req.body.role,

      photo: req.body.photo || null,

      govtId: req.body.govtId || null
    });


  // assign to resident
  await repo.createStaffAssignment({

    societyId: new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    residentId: req.user.id,

    staffId: profile._id
  });

  return profile;
};



// ================= GET MY STAFF =================
exports.getMyStaff = async (req) => {

  return await repo.getResidentStaff(
    req.user.id
  );
};



// ================= APPROVE STAFF =================
exports.approveStaff = async (id) => {

  return await repo.updateStaffProfile(
    id,
    {
      verificationStatus: "approved"
    }
  );
};



// ================= REJECT STAFF =================
exports.rejectStaff = async (id) => {

  return await repo.updateStaffProfile(
    id,
    {
      verificationStatus: "rejected"
    }
  );
};



// ================= BLOCK STAFF =================
exports.blockStaff = async (
  id,
  reason
) => {

  return await repo.updateStaffProfile(
    id,
    {
      verificationStatus: "blocked",
      blockedReason: reason || ""
    }
  );
};



// ================= REMOVE STAFF =================
exports.removeStaff = async (
  assignmentId
) => {

  return await repo.deactivateStaffAssignment(
    assignmentId
  );
};


// ================= MARK ENTRY =================
exports.markEntry = async (req) => {

  const {
    staffId,
    status,
    notes
  } = req.body;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // check today's record
  const existing =
    await repo.getTodayAttendance(
      req.user.id,
      staffId,
      start,
      end
    );

  if (existing) {
    throw new Error(
      "Attendance already marked today"
    );
  }

  return await repo.createAttendance({

    societyId: new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    residentId: req.user.id,

    staffId,

    entryTime:
      status === "present"
        ? new Date()
        : null,

    status,

    notes: notes || ""
  });
};



// ================= MARK EXIT =================
exports.markExit = async (
  attendanceId
) => {

  return await repo.updateAttendance(
    attendanceId,
    {
      exitTime: new Date()
    }
  );
};



// ================= GET MY ATTENDANCE =================
exports.getMyAttendance = async (
  req
) => {

  return await repo.getResidentAttendance(
    req.user.id
  );
};


// ================= CREATE ALERT =================
exports.createSecurityAlert = async (
  req
) => {

  return await repo.createSecurityAlert({

    societyId: new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    residentId: req.user.id,

    visitorRequestId:
      req.body.visitorRequestId || null,

    type: req.body.type,

    message: req.body.message
  });
};



// ================= GET ALERTS =================
exports.getSecurityAlerts = async (
  req
) => {

  return await repo.getSecurityAlerts(
    req.user.societyId
  );
};



// ================= RESOLVE ALERT =================
exports.resolveAlert = async (id) => {

  const alert =
    await repo.getSecurityAlertById(id);

  if (!alert) {
    throw new Error(
      "Alert not found"
    );
  }

  return await repo.updateSecurityAlert(
    id,
    {
      status: "resolved",
      resolvedAt: new Date()
    }
  );
};