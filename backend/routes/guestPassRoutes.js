const express=require("express");
const router=express.Router();
const guestPassController=require("../controllers/guestPassController");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved=require("../middleware/checkApproved");
const authorize =
  require("../middleware/requireRole").requireSocietyRole;

//======================================================================
// AUTHENTICATED ROUTES
//====================================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);


//======================================================================
//Comitee ROutes
//======================================================================
// NOTE: literal paths must stay above "/:guestPassId" or they are
// swallowed by the parameterised route.

//society guest passes
router.get("/society",authorize("chairman","secretary","committee_member"),guestPassController.getGuestPassesBySociety);

//statistics
router.get("/statistics",authorize("chairman","secretary","committee_member"),guestPassController.getGuestPassStatistics);


//======================================================================
//RESIDENT ROUTES
//======================================================================


//create guest pass
router.post("/",authorize("member","chairman","secretary","committee_member"),guestPassController.createGuestPass);


//resident guest passes
router.get("/resident/:residentId",authorize("member","chairman","secretary","committee_member"),guestPassController.getResidentGuestPasses);


//create pass on behalf of a resident
router.post("/resident/:residentId",authorize("member","chairman","secretary","committee_member"),guestPassController.createGuestPass);


//extend Guest pass
router.patch("/:guestPassId/extend",authorize("member","chairman","secretary","committee_member"),guestPassController.extendGuestPass);


//Cancel guest pass
router.patch("/:guestPassId/cancel",authorize("member","chairman","secretary","committee_member"),guestPassController.cancelGuestPass);


//Approve passes
router.patch("/:guestPassId/approve",authorize("chairman","secretary"),guestPassController.approveGuestPass);


//======================================================================
//Admin Routes
//======================================================================

//Archive guest pass
router.patch("/:guestPassId/archive",authorize("chairman","secretary"),guestPassController.archiveGuestPass);


//======================================================================
//GUARD ROUTES
//======================================================================

//regenerate QR
router.patch("/:guestPassId/regenerate",authorize("security"),guestPassController.regenerateGuestPassQRCode);

//get guest pass
router.get("/:guestPassId",authorize("security"),guestPassController.getGuestPassById);


module.exports=router;
