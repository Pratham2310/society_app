const express =require("express");

const router=express.Router();

const authMiddleware=require("../middleware/authMiddleware");
const checkSystemRole=require("../middleware/checkSystemRole");

const adminController=require("../controllers/adminController");

router.post("/create-salesperson",authMiddleware,checkSystemRole("superadmin"),adminController.createSalesperson);
router.post("/create-superadmin", adminController.createSuperAdmin);

module.exports=router;