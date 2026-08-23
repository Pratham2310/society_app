const express=require("express");
const router=express.Router();

const upload=require("../middleware/upload");
const auth=require("../middleware/authMiddleware");
const tenantScope =
  require("../middleware/tenantScope");
const checkApproved=require("../middleware/checkApproved");
const {uploadLimiter}=require("../middleware/rateLimitMiddleware");
const asyncHandler=require("../utils/asyncHandler");
const {sendResponse}=require("../utils/responseHelper");
const AppError=require("../utils/appError");

//Uploads are authenticated, approval-gated and rate limited.
//An anonymous upload endpoint is a storage-cost attack waiting to happen.
router.post(
  "/upload",
  auth, tenantScope,
  checkApproved,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async(req,res)=>{

    if(!req.file){
      throw new AppError("No file was uploaded.",400);
    }

    sendResponse(res,201,true,"File uploaded successfully",{
      url:req.file.path,
      publicId:req.file.filename,
      size:req.file.size,
    });

  })
);

//======================================================================
//SIGNED DIRECT UPLOAD
//======================================================================
//The device POSTs the file straight to Cloudinary using this
//signature, so a resident's photo never transits the Render instance.
//On a 512MB box, proxying uploads costs the bandwidth twice and blocks
//the event loop while streaming.
//
//The signature is scoped to the caller's society folder, so a signed
//request cannot be redirected into another tenant's namespace.
router.post(
  "/signature",
  auth,
  checkApproved,
  uploadLimiter,
  asyncHandler(async(req,res)=>{

    const cloudinary=require("../config/cloudinary");

    const societyId=req.user?.societyId
      ? String(req.user.societyId)
      : "unscoped";

    const timestamp=Math.round(Date.now()/1000);

    const params={
      timestamp,
      folder:`society-app/${societyId}`,
    };

    const signature=cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_SECRET
    );

    sendResponse(res,200,true,"Upload signature issued",{
      signature,
      timestamp,
      folder:params.folder,
      apiKey:process.env.CLOUDINARY_KEY,
      cloudName:process.env.CLOUDINARY_NAME,
      uploadUrl:`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_NAME}/auto/upload`,
      //Signatures are short-lived by Cloudinary's own rules; the client
      //should request one per upload rather than caching it.
      expiresInSeconds:3600,
    });

  })
);

module.exports=router;
