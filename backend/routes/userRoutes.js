const express=require("express");
const router=express.Router();

const userController=require("../controllers/userController");
const asyncHandler=require("../utils/asyncHandler");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const ROLES=require("../utils/roles");
const role =
  require("../middleware/requireRole").requireSocietyRole;


//register User with full details
router.post("/register-full",asyncHandler(userController.registerFull));

//get pending user for secretary
router.get("/pending-users",auth, tenantScope,role(ROLES.SECRETARY),asyncHandler(userController.getPendingUsers));

// router.get("/pending-users",(req,res)=>{
//   console.log("pending user route hit");
//   res.send("pending route working");
// })


//approve user by secretary
// router.put("/approve-user/:userId",auth, tenantScope,role(ROLES.SECRETARY),asyncHandler(userController.approveUser));

// //reject user by secretary
// router.put("/reject-user/:userId",auth, tenantScope,role(ROLES.SECRETARY),asyncHandler(userController.rejectUser));

//update-status by secretary
router.put("/update-status/:userId",auth, tenantScope,role(ROLES.SECRETARY,ROLES.CHAIRMAN),asyncHandler(userController.updateStatus));

//get all users in society
router.get("/all-users/",auth, tenantScope,asyncHandler(userController.getAllUsers));

router.get("/user-by-wing/:wingId",auth, tenantScope,asyncHandler(userController.getUserByWing));

//role transfer and update role by secretary
router.put("/update-role/:userId",auth, tenantScope,role(ROLES.SECRETARY),asyncHandler(userController.updateUserRole));



module.exports=router;