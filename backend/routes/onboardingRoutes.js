const express=require("express");
const router=express.Router();

const authMiddleware=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;

const onboardingController=require("../controllers/onboardingController");

router.post("/step1",authMiddleware, tenantScope,checkSystemRole("salesperson"),onboardingController.step1);
router.post("/step2",authMiddleware, tenantScope,checkSystemRole("salesperson"),onboardingController.step2);
router.post("/step3",authMiddleware, tenantScope,checkSystemRole("salesperson"),onboardingController.step3);
router.post("/step4",authMiddleware, tenantScope,checkSystemRole("salesperson"),onboardingController.step4);
router.post("/finalize",authMiddleware, tenantScope,checkSystemRole("salesperson"),onboardingController.finalize);

module.exports=router;