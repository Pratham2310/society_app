const express=require("express");
const router=require("router");
const guestPassController=require("../controllers/guestPassController");
const auth=require("../middleware/authMiddleware");
const checkApproved=require("../middleware/checkApproved");
const authorize=require("../middleware/authorizeRoles");

//======================================================================
// AUTHENTICATED ROUTES
//====================================================================

router.use(auth);
router.use(checkApproved);


//======================================================================
//RESIDENT ROUTES
//======================================================================


//create guest pass
router.post("/",authorize("member","chairman","secretary","comitee-member"),guestPassController.createGuestPass);


//resident guest pass
router.post("/resident/:residentId",authorize("member","chairman","secretary","comitee-member"),guestPassController.createGuestPass);


//extend Guest pass
router.patch("/:guestPassId/extend",authorize("member","chairman","secretary","comitee-member"),guestPassController.extendGuestPass);


//Cancel guest pass
router.patch("/:guestPassId/cancel",authorize("member","chairman","secretary","comitee-member"),guestPassController.cancelGuestPass);


//======================================================================
//GUARD ROUTES
//======================================================================

//get guest pass
router.get("/:guestPassId",authorize("guard"),guestPassController.getGuestPassById);

//regenerate QR
router.patch("/:guestPassId/regenerate",authorize("guard"),guestPassController.regenerateGuestPassQRCode);


//======================================================================
//Comitee ROutes
//======================================================================

//society guest passes
router.get("/society",authorize("chairman","secretary","comitee-member"),guestPassController.getSocietyGuestPasses);

//statistics
router.get("/statistics",authorize("chairman","secretary","comitee-member"),guestPassController.getGuestPassStatistics);

//Approve passes
router.patch("/:guestPassId/approve",authorize("chairman","secretary"),guestPassController.approveGuestPass);



//======================================================================
//Admin Routes
//======================================================================

//Archive guest pass
router.patch("/:guestPassId/archive",authorize("admin"),guestPassController.archiveGuestPass);


module.exports=router;