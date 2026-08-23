const userServices = require("../services/userServices");
const audit = require("../services/auditService");

// REGISTER
exports.registerFull = async (req, res) => {
  const user = await userServices.registerFull(req.body);

  const userObj = user.toObject();
  delete userObj.password;

  res.json({
    success: true,
    message: "Registration completed, wait for approval",
    user: userObj
  });
};

// GET PENDING USERS
exports.getPendingUsers = async (req, res) => {
  const users = await userServices.getPendingUsers(req.user.societyId);

  res.json({
    success: true,
    users
  });
};

// UPDATE STATUS
exports.updateStatus = async (req, res) => {
  const user = await userServices.updateStatus(
    req.user,
    req.params.userId,
    req.body.status
  );

  const userObj = user.toObject();
  delete userObj.password;

  await audit.record(req.user, audit.ACTIONS.USER_STATUS_CHANGED, {
    targetType: "User",
    targetId: req.params.userId,
    metadata: { status: req.body.status },
    req,
  });

  res.json({
    success: true,
    message: `User ${req.body.status} successfully`,
    user: userObj
  });
};

// GET ALL USERS
exports.getAllUsers = async (req, res) => {
  const users = await userServices.getAllUsers(req.user.societyId);

  res.json({ success: true, users });
};

// GET BY WING
exports.getUserByWing = async (req, res) => {
  const users = await userServices.getUserByWing(
    req.user.societyId,
    req.params.wingId
  );

  res.json({ success: true, users });
};

// UPDATE ROLE
exports.updateUserRole = async (req, res) => {
  const user = await userServices.updateUserRole(
    req.user,
    req.params.userId,
    req.body.role
  );

  const userObj = user.toObject();
  delete userObj.password;

  await audit.record(req.user, audit.ACTIONS.USER_ROLE_CHANGED, {
    targetType: "User",
    targetId: req.params.userId,
    metadata: { newRole: req.body.role },
    req,
  });

  res.json({
    success: true,
    message: "Role updated",
    user: userObj
  });
};