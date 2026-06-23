const express=require("express");
const router=express.Router();

const mapController=require("../controllers/mapController");
const asyncHandler=require("../utils/asyncHandler");
const authMiddleware=require("../middleware/authMiddleware");
const checkApproved=require("../middleware/checkApproved");


//protected
router.use(authMiddleware);
router.use(checkApproved);

//=========SERVICES=========
//get all services
router.get("/services",mapController.getSocietyServices);

//get single service details
router.get("/services/:id",mapController.getServiceDetails);

//toggle visibility
router.patch("services/:id/toggle",mapController.toggleVisibility);

module.exports=router;

