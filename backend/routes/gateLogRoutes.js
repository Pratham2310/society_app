const express= require("express");
const router= express.Router();
const gateLogController=require("../controllers/gateLogController");
const auth=require("../middleware/authMiddleware");
const checkApproved=require("../middleware/checkApproved");
const authorize=require("../middleware/authorizeRoles");

//=====================================================================
//Authentication
//=====================================================================

router.use(auth);
router.use(checkApproved);

//=====================================================================
//Guard Routes
//=====================================================================

//scan visitor entry
router.post("/scan-entry",authorize("guard"),gateLogController.scanVisitorEntry);

//scan visitor exit
router.post("/scan-exit",authorize("guard"),gateLogController.scanVisitorExit);


//=====================================================================
//Comitee routes
//=====================================================================

//get All gate Logs
router.get("/society",authorize("chairman","secretary","comitee-member"),gateLogController.getGateLogs);

//get guest visit entry
router.get("/guest/:guestPassId",authorize("chairman","secretary","comitee-member"),guestPassController.getGateVisitHistory);

//TOdays logs
router.get("/today",authorize("chairman","secretary","comitee-member"),gateLogController.getTodayGateLogs);



//=====================================================================
//Admin Routes
//=====================================================================

//statistics
router.get("/statistics",authorize("admin"),gateLogController.getGateLogStatistics);

module.exports=router;