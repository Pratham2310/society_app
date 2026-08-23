const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");
const ctrl = require("../controllers/expenseController");

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

// 🔥 ADMIN
router.post("/", ctrl.createExpense);
router.put("/:id/publish", ctrl.publishExpense);
router.put("/:id/visibility", ctrl.toggleVisibility);

// 🔥 BOTH
router.get("/", ctrl.getExpenses);

module.exports = router;