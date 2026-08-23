const express=require("express");
const router=express.Router();
const visitorApprovalController=require("../controllers/visitorApprovalController");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved=require("../middleware/checkApproved");
const authorize =
  require("../middleware/requireRole").requireSocietyRole;


//=====================================================================
//Authentication
//=====================================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

//====================================================================
//Guard Routes
//====================================================================

//Request Approval
router.post("/",authorize("security"),visitorApprovalController.requestApproval);

//cancel approval request
router.patch("/:approvalId/cancel",authorize("security"),visitorApprovalController.cancelRequest);

//guard pending requests
router.get("/pending",authorize("security"),visitorApprovalController.getGuardPendingRequests);



//=====================================================================
//Resident Routes
//=====================================================================

//Resident pending requests
router.get("/resident/pending",authorize("member","chairman","secretary","treasurer","committee_member"),visitorApprovalController.getResidentPendingRequests);

//get approve request
//Every resident can answer for their OWN flat — the service checks
//ownership. Restricting this to member+chairman locked a treasurer,
//secretary or committee member out of approving their own visitor.
//"security" is deliberately absent: a guard raises the request, the
//resident answers it.
router.patch("/:approvalId/approve",authorize("member","chairman","secretary","treasurer","committee_member"),visitorApprovalController.approveRequest);

//reject request
router.patch("/:approvalId/reject",authorize("member","chairman","secretary","treasurer","committee_member"),visitorApprovalController.rejectRequest);



//========================================================================
//Comitee Routes
//========================================================================

//Approval statistics
//NOTE: literal path must stay above "/:approvalId".
router.get("/statistics",authorize("chairman","secretary","committee_member"),visitorApprovalController.getApprovalStatistics);

//get Approval by ID
router.get("/:approvalId",authorize("chairman","secretary","committee_member"),visitorApprovalController.getApprovalById);

module.exports=router;