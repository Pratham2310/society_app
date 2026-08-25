const express = require("express");
const router = express.Router();

const financeController = require("../controllers/financeController");
const asyncHandler = require("../utils/asyncHandler");
const auth = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenantScope");
const checkApproved = require("../middleware/checkApproved");

// =======================================================
// FINANCE
//
// The app's money tab, which mixes maintenance, expenses and fund
// campaigns on nearly every screen. The older /maintenance, /expenses
// and /community-funds routes still stand — they are what the web
// console uses.
//
// No permission guards here on purpose. Several of these read
// differently depending on the caller rather than being allowed or
// refused outright, so the service decides. Writes check before they
// write.
// =======================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);


router.get("/overview", asyncHandler(financeController.getOverview));


// ---- maintenance ---------------------------------------------------
// The literal paths come first; none of these take an id, but keeping
// the order explicit means adding /maintenance/:id later cannot
// swallow them.

router.get("/maintenance", asyncHandler(financeController.listMaintenance));
router.get("/maintenance/hub", asyncHandler(financeController.getMaintenanceHub));
router.put("/maintenance/amount", asyncHandler(financeController.setMaintenanceAmount));
router.post("/maintenance/reminders", asyncHandler(financeController.sendMaintenanceReminders));


// ---- expenses ------------------------------------------------------

router.get("/expenses", asyncHandler(financeController.listExpenses));
router.post("/expenses", asyncHandler(financeController.createExpense));
router.put("/expenses/:id", asyncHandler(financeController.updateExpense));
router.delete("/expenses/:id", asyncHandler(financeController.deleteExpense));


// ---- contributions -------------------------------------------------
// Declared above /campaigns/:id so "contributions" and "contributors"
// are never read as a campaign id.

router.get("/contributors", asyncHandler(financeController.listContributors));
router.post("/contributions", asyncHandler(financeController.createContribution));
router.get("/contributions/:id/receipt", asyncHandler(financeController.getContributionReceipt));
router.patch("/contributions/:id/verify", asyncHandler(financeController.verifyContribution));


// ---- fund campaigns ------------------------------------------------

router.get("/campaigns", asyncHandler(financeController.listCampaigns));
router.post("/campaigns", asyncHandler(financeController.createCampaign));
router.get("/campaigns/:fundId/contributions", asyncHandler(financeController.listFundContributions));
router.put("/campaigns/:id", asyncHandler(financeController.updateCampaign));
router.delete("/campaigns/:id", asyncHandler(financeController.deleteCampaign));


module.exports = router;
