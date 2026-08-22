// const express=require("express");
// const router=express.Router();

// const inviteController=require("../controllers/inviteController");
// const authMiddleware=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");

// router.post("/",authMiddleware, tenantScope,inviteController.createInvite);
// router.post("/:token",inviteController.validateInvite);

// module.exports=router;