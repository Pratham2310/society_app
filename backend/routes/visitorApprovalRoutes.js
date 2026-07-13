const express=require("express");
const router=express.Router();
const visitorApprovalController=require("../controllers/visitorApprovalController");
const auth=require("../middleware/authMiddleware");
const checkApproved=require("../middleware/checkApproved");
const authorize=require("../middleware/authorizeRoles");


//=====================================================================
//Authentication
//=====================================================================

router.use(auth);
router.use(checkApproved);

//====================================================================
//Guard Routes
//====================================================================

//Request Approval
router.post("/",authorize("guard"),visitorApprovalController.requestApproval);

//cancel approval request
router.patch("/:approvalId/cancel",authorize("guard"),visitorApprovalController.cancelRequest);

//guard pending requests
router.get("/pending",authorize("guard"),visitorApprovalController.getGuardPendingRequests);



//=====================================================================
//Resident Routes
//=====================================================================

//Resident pending requests
router.get("/resident/pending",authorize("member","chairman"),visitorApprovalController.getResidentPendingRequests);

//get approve request
router.patch("/:approvalId/approve",authorize("member","chairman"),visitorApprovalController.approveRequest);

//reject request
router.patch("/:approvalId/reject",authorize("member","chairman"),visitorApprovalController.rejectRequest);



//========================================================================
//Comitee Routes
//========================================================================

//get Approval by ID
router.get("/:approvalId",authorize("chairman","secretary","comitee-member"),visitorApprovalCOntroller.getApprovedById);

//Approval statistics
router.get("statistics",authorize("chairman","secretary","comitee-member"),visitorApprovalCOntroller.getApprovalStatistics);

module.exports=router;