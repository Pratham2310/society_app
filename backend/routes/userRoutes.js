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
const meController=require("../controllers/meController");
const { requirePermission } =
  require("../middleware/requirePermission");
const { PERMISSIONS } = require("../config/permissions");


// =======================================================
// THE SIGNED-IN USER
//
// These sit above the /:userId routes on purpose. Express matches in
// order, and "me" would otherwise be read as an id by anything
// declared first.
// =======================================================

router.get("/me",auth, tenantScope,asyncHandler(meController.getMe));

//What this user may do. The app hides any control it does not hold,
//so a button never appears that would come back 403.
router.get("/me/permissions",auth, tenantScope,asyncHandler(meController.getMyPermissions));

//An edit the secretary has to approve, not a write.
router.put("/me/profile",auth, tenantScope,asyncHandler(meController.requestProfileChange));

//A photo carries none of that weight, so it applies immediately.
router.put("/me/avatar",auth, tenantScope,asyncHandler(meController.setAvatar));

router.get("/me/vehicles",auth, tenantScope,asyncHandler(meController.listVehicles));
router.post("/me/vehicles",auth, tenantScope,asyncHandler(meController.addVehicle));
router.delete("/me/vehicles/:vehicleId",auth, tenantScope,asyncHandler(meController.removeVehicle));

//The VAPID public key. Public by definition — it is compiled into
//every browser client — and needed before sign-in on the web, so it
//takes no token.
router.get("/web-push-key",asyncHandler(meController.getWebPushKey));

router.post("/me/web-push",auth, tenantScope,asyncHandler(meController.saveWebPushSubscription));
router.delete("/me/web-push",auth, tenantScope,asyncHandler(meController.removeWebPushSubscription));

router.post("/me/push-token",auth, tenantScope,asyncHandler(meController.registerPushToken));
router.delete("/me/push-token",auth, tenantScope,asyncHandler(meController.removePushToken));

//The secretary's queue of resident-requested profile edits.
router.get("/profile-change-requests",auth, tenantScope,requirePermission(PERMISSIONS.MEMBERS_APPROVE),asyncHandler(meController.listProfileChangeRequests));
router.put("/profile-change-requests/:userId",auth, tenantScope,requirePermission(PERMISSIONS.MEMBERS_APPROVE),asyncHandler(meController.decideProfileChange));



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
//Approve or decline. The whole committee shares this queue — approvals
//stall if one person is the only one who can clear them. Declining
//hands the flat back, so a resident who picked the wrong one does not
//hold it forever.
router.put("/update-status/:userId",auth, tenantScope,role(ROLES.SECRETARY,ROLES.CHAIRMAN,ROLES.TREASURER,ROLES.COMMITTEE_MEMBER),asyncHandler(userController.updateStatus));

//Once someone is approved, declining is no longer the answer to a
//wrong flat — move them instead. Frees the old flat and claims the new
//one in one transaction.
router.put("/reassign-flat/:userId",auth, tenantScope,role(ROLES.SECRETARY,ROLES.CHAIRMAN,ROLES.TREASURER,ROLES.COMMITTEE_MEMBER),asyncHandler(userController.reassignFlat));

//Someone who moved out. Frees their flat for the next occupant.
router.delete("/resident/:userId",auth, tenantScope,role(ROLES.SECRETARY,ROLES.CHAIRMAN,ROLES.TREASURER,ROLES.COMMITTEE_MEMBER),asyncHandler(userController.removeResident));

//get all users in society
router.get("/all-users/",auth, tenantScope,asyncHandler(userController.getAllUsers));

router.get("/user-by-wing/:wingId",auth, tenantScope,asyncHandler(userController.getUserByWing));

//role transfer and update role by secretary
router.put("/update-role/:userId",auth, tenantScope,role(ROLES.SECRETARY),asyncHandler(userController.updateUserRole));



module.exports=router;