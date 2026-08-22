const express =require("express");

const router=express.Router();

const authMiddleware=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;

const adminController=require("../controllers/adminController");

router.post("/create-salesperson",authMiddleware, tenantScope,checkSystemRole("superadmin"),adminController.createSalesperson);

//NOTE: superadmin creation is deliberately NOT a route.
//An unauthenticated endpoint that mints superadmins is a full
//account-takeover primitive. Use the one-time bootstrap script:
//   npm run bootstrap:superadmin
//See backend/scripts/createSuperadmin.js

module.exports=router;
