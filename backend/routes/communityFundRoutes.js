const express=require("express");
const router=express.Router();

const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved=require("../middleware/checkApproved");
const checkRole =
  require("../middleware/requireRole").requireSocietyRole;
const ctrl=require("../controllers/communityFundController");

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

//create Fund secretary
router.post("/",checkRole("secretary"),ctrl.createFund);

//get funds
router.get("/",ctrl.getFunds);
router.post("/:id/contribute",ctrl.contribute);

//secretary
router.put("/contribution/:id",ctrl.approveContribution);

module.exports=router;