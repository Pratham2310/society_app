const express =require("express");

const router=express.Router();

const authMiddleware=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkSystemRole =
  require("../middleware/requireRole").requireSystemRole;

const adminController=require("../controllers/adminController");

router.post("/create-salesperson",authMiddleware, tenantScope,checkSystemRole("superadmin"),adminController.createSalesperson);

//The roster, with how many societies each person has onboarded.
//Superadmin only — a salesperson has no reason to see colleagues'
//accounts, and they already cannot see each other's societies.
router.get("/salespeople",authMiddleware, tenantScope,checkSystemRole("superadmin"),adminController.listSalespeople);

//NOTE: superadmin creation is deliberately NOT a route.
//An unauthenticated endpoint that mints superadmins is a full
//account-takeover primitive. Use the one-time bootstrap script:
//   npm run bootstrap:superadmin
//See backend/scripts/createSuperadmin.js

module.exports=router;
