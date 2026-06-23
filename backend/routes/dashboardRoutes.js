const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const checkApproved = require("../middleware/checkApproved"); // ✅ FIXED

router.use(authMiddleware);
router.use(checkApproved);

router.get("/", dashboardController.getDashboard);

module.exports = router;