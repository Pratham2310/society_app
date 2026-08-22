const guestPassService = require("../services/guestPassService");

const catchAsync = require("../utils/asyncHandler");

const { sendResponse } = require("../utils/responseHelper");

//=======================================================
//CREATE GUEST PASS
//=======================================================

exports.createGuestPass = catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.createGuestPass(body,user);
    sendResponse(res,
        201,
        true,
        "Guest pass created successfully",
        guestPass
    );
});



//=======================================================
//GET GUEST PASS BY ID
//=======================================================

exports.getGuestPassById=catchAsync(async(req,res)=>{
    const{guestPassId}=req.params;
    const user=req.user;
    const guestPass=await guestPassService.getGuestPassById(guestPassId,user);
    sendResponse(res,
        200,
        true,
        "Guest pass fetched successfully",
        guestPass
    );
});


//=======================================================
//GET RESIDENT GUEST PASSES
//=======================================================

exports.getResidentGuestPasses=catchAsync(async(req,res)=>{
    const {
        residentId
    }=req.params;

    const user=req.user;
    const options=req.query;
    const guestPasses=await guestPassService.getResidentGuestPasses(residentId,user,options);
    sendResponse(res,
        200,
        true,
        "Resident guest passes fetched successfully",
        guestPasses
    );
});



//=======================================================
//GET SOCIETY GUEST PASSES
//=======================================================

exports.getGuestPassesBySociety=catchAsync(async(req,res)=>{
    const user=req.user;
    const options=req.query;
    const guestPasses=await guestPassService.getSocietyGuestPasses(user,options);
    sendResponse(res,
        200,
        true,
        "Society guest passes fetched successfully",
        guestPasses
    );
});


//=======================================================
//APPROVE GUEST PASS
//=======================================================

exports.approveGuestPass=catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.approveGuestPass(body,user);
    sendResponse(res,
        200,
        true,
        "Guest pass approved successfully",
        guestPass
    );
});


//=======================================================
//CANCEL GUEST PASS
//=======================================================

exports.cancelGuestPass=catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.cancelGuestPass(body,user);
    sendResponse(res,
        200,
        true,
        "Guest pass cancelled successfully",
        guestPass
    );
});


//=======================================================
//EXTEND GUEST PASS
//=======================================================

exports.extendGuestPass=catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.extendGuestPass(body,user);
    sendResponse(res,
        200,
        true,
        "Guest pass extended successfully",
        guestPass
    );
});


//=======================================================
//ARCHEIVE GUEST PASS
//=======================================================

exports.archiveGuestPass=catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.archiveGuestPass(body,user);
    sendResponse(res,
        200,
        true,
        "Guest pass archived successfully",
        guestPass
    );
});


//=======================================================
//REGENERATE GUEST PASS QR
//=======================================================

exports.regenerateGuestPassQRCode=catchAsync(async(req,res)=>{
    const body=req.body;
    const user=req.user;
    const guestPass=await guestPassService.regenerateGuestPassQRCode(body,user);
    sendResponse(res,
        200,
        true,
        "Guest pass QR code regenerated successfully",
        guestPass
    );
});


// =======================================================
// GET GUEST PASS STATISTICS
// =======================================================

exports.getGuestPassStatistics = catchAsync(

  async (req, res) => {

    const user = req.user;

    const statistics =
      await guestPassService.getGuestPassStatistics(

        user.societyId

      );

    sendResponse(

      res,

      200,

      true,

      "Guest pass statistics fetched successfully.",

      statistics

    );

  }

);

