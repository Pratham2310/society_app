const express=require("express");
const router=express.Router();

const authMiddleware=require("../middleware/authMiddleware");
const checkSystemRole=require("../middleware/checkSystemRole");

const onboardingController=require("../controllers/onboardingController");

router.post("/step1",authMiddleware,checkSystemRole("salesperson"),onboardingController.step1);
router.post("/step2",authMiddleware,checkSystemRole("salesperson"),onboardingController.step2);
router.post("/step3",authMiddleware,checkSystemRole("salesperson"),onboardingController.step3);
router.post("/step4",authMiddleware,checkSystemRole("salesperson"),onboardingController.step4);
router.post("/finalize",authMiddleware,checkSystemRole("salesperson"),onboardingController.finalize);

module.exports=router;