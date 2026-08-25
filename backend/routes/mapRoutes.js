const societyMapController = require("../controllers/societyMapController");
const express=require("express");
const router=express.Router();

const mapController=require("../controllers/mapController");
const asyncHandler=require("../utils/asyncHandler");
const authMiddleware=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved=require("../middleware/checkApproved");


//protected
router.use(authMiddleware);
router.use(tenantScope);
router.use(checkApproved);

//=========SERVICES=========
//get all services
// =======================================================
// THE SOCIETY MAP
//
// Pins on the society's layout. The /map/services routes below are
// the older catalogue-toggle ones and stay for the web console.
//
// "catalog" is declared ahead of /:id so it is never read as an id.
// =======================================================

router.get("/catalog", asyncHandler(societyMapController.getCatalog));
router.get("/", asyncHandler(societyMapController.listMap));
router.post("/", asyncHandler(societyMapController.addMapItem));
router.patch("/:id", asyncHandler(societyMapController.updateMapItem));
router.put("/:id", asyncHandler(societyMapController.updateMapItem));
router.delete("/:id", asyncHandler(societyMapController.deleteMapItem));


router.get("/services",mapController.getSocietyServices);

//get single service details
router.get("/services/:id",mapController.getServiceDetails);

//toggle visibility
router.patch("/services/:id/toggle",mapController.toggleVisibility);

module.exports=router;

