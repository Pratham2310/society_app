const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");
const complaintController = require("../controllers/complaintController");

router.use(authMiddleware);
router.use(tenantScope);
router.use(checkApproved);

router.post("/", complaintController.createComplaint);
router.get("/", complaintController.getComplaints);
router.get("/:id", complaintController.getComplaintById);
router.put("/:id/status", complaintController.updateStatus);

module.exports = router;