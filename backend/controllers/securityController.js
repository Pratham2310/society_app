const securityService = require(
  "../services/securityService"
);

const {
  updateSecurityStatusSchema
} = require(
  "../validation/securityValidation"
);

const {
  visitorRequestSchema
}=require("../validation/securityValidation")

const {createStaffSchema,markAttendanceSchema,createSecurityAlertSchema}=require("../validation/securityValidation");


// ================= GET MY STATUS =================
exports.getMyStatus = async (req, res) => {

  try {

    const data =
      await securityService.getMyStatus(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= UPDATE STATUS =================
exports.updateStatus = async (req, res) => {

  try {

    const { error } =
      updateSecurityStatusSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data =
      await securityService.updateStatus(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= CREATE VISITOR REQUEST =================
exports.createVisitorRequest = async (req, res) => {

  try {

    const { error } =
      visitorRequestSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data =
      await securityService
        .createVisitorRequest(req);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= GET VISITOR REQUESTS =================
exports.getVisitorRequests = async (req, res) => {

  try {

    const data =
      await securityService
        .getVisitorRequests(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= APPROVE =================
exports.approveVisitor = async (req, res) => {

  try {

    const data =
      await securityService
        .approveVisitor(req.params.id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= REJECT =================
exports.rejectVisitor = async (req, res) => {

  try {

    const data =
      await securityService
        .rejectVisitor(req.params.id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= FRAUD =================
exports.reportFraud = async (req, res) => {

  try {

    const data =
      await securityService
        .reportFraud(req.params.id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= ADD STAFF =================
exports.addStaff = async (req, res) => {

  try {

    const { error } =
      createStaffSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data =
      await securityService.addStaff(req);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= GET MY STAFF =================
exports.getMyStaff = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.getMyStaff(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= APPROVE =================
exports.approveStaff = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.approveStaff(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= REJECT =================
exports.rejectStaff = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.rejectStaff(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= BLOCK =================
exports.blockStaff = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.blockStaff(
        req.params.id,
        req.body.reason
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= REMOVE =================
exports.removeStaff = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.removeStaff(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= MARK ENTRY =================
exports.markEntry = async (
  req,
  res
) => {

  try {

    const { error } =
      markAttendanceSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data =
      await securityService.markEntry(
        req
      );

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= MARK EXIT =================
exports.markExit = async (
  req,
  res
) => {

  try {

    const data =
      await securityService.markExit(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= GET ATTENDANCE =================
exports.getMyAttendance = async (
  req,
  res
) => {

  try {

    const data =
      await securityService
        .getMyAttendance(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= CREATE ALERT =================
exports.createSecurityAlert = async (
  req,
  res
) => {

  try {

    const { error } =
      createSecurityAlertSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const data =
      await securityService
        .createSecurityAlert(req);

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= GET ALERTS =================
exports.getSecurityAlerts = async (
  req,
  res
) => {

  try {

    const data =
      await securityService
        .getSecurityAlerts(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};


// ================= RESOLVE =================
exports.resolveAlert = async (
  req,
  res
) => {

  try {

    const data =
      await securityService
        .resolveAlert(req.params.id);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};