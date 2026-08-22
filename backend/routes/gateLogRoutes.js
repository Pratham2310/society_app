const express= require("express");
const router= express.Router();
const gateLogController=require("../controllers/gateLogController");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const idempotency =
  require("../middleware/idempotency");
const checkApproved=require("../middleware/checkApproved");
const authorize =
  require("../middleware/requireRole").requireSocietyRole;

//=====================================================================
//Authentication
//=====================================================================

router.use(auth);
router.use(tenantScope);
router.use(checkApproved);

//=====================================================================
//Guard Routes
//=====================================================================

//scan visitor entry
router.post("/scan-entry",idempotency,authorize("security"),gateLogController.scanVisitorEntry);

//scan visitor exit
router.post("/scan-exit",idempotency,authorize("security"),gateLogController.scanVisitorExit);


//=====================================================================
//Comitee routes
//=====================================================================

//get All gate Logs
router.get("/society",authorize("chairman","secretary","committee_member"),gateLogController.getGateLogs);

//get guest visit entry
router.get("/guest/:guestPassId",authorize("chairman","secretary","committee_member"),gateLogController.getGuestVisitHistory);

//TOdays logs
router.get("/today",authorize("chairman","secretary","committee_member"),gateLogController.getTodayGateLogs);



//=====================================================================
//Admin Routes
//=====================================================================

//statistics
router.get("/statistics",authorize("chairman","secretary"),gateLogController.getGateLogStatistics);

module.exports=router;