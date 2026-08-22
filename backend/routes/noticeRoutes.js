const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");
const checkRole =
  require("../middleware/requireRole").requireSocietyRole;
const noticeController = require("../controllers/noticeController");

// ✅ APPLY AUTH FIRST
router.use(authMiddleware);
router.use(tenantScope);

// ✅ THEN APPROVAL
router.use(checkApproved);

// ✅ CREATE
router.post(
  "/",
  checkRole("secretary", "chairman", "treasurer", "committee_member"),
  noticeController.createNotice
);

// ✅ GET ALL
router.get("/", noticeController.getNotices);

// ✅ GET ONE
router.get("/:id", noticeController.getNoticeById);

// ✅ UPDATE
router.put(
  "/:id",
  checkRole("secretary", "chairman", "treasurer", "committee_member"),
  noticeController.updateNotice
);

// ✅ DELETE
router.delete(
  "/:id",
  checkRole("secretary", "chairman", "treasurer", "committee_member"),
  noticeController.deleteNotice
);

module.exports = router;