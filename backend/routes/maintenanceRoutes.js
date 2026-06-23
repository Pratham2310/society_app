const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const checkApproved = require("../middleware/checkApproved");
const ctrl = require("../controllers/maintenanceController");

router.use(auth);
router.use(checkApproved);

// resident
router.get("/my", ctrl.getMyBills);

// admin
router.post("/generate", ctrl.generateBills);
router.get("/", ctrl.getAllBills);
router.put("/:id/pay", ctrl.markAsPaid);
router.put("/:id/pending", ctrl.markPending);
router.post("/:id/reminder", ctrl.sendReminder);

module.exports = router;