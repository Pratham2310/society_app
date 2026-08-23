const noticeServices=require("../services/noticeService");
const asyncHandler=require("../utils/asyncHandler");
const {sendResponse}=require("../utils/responseHelper");

//No local try/catch: asyncHandler forwards to the global error
//handler, which preserves AppError status codes. Catching here and
//returning 500 turned every 404 and 403 into "Internal Server Error".

exports.createNotice=asyncHandler(async (req,res)=>{
    const data=await noticeServices.createNotice(req);
    sendResponse(res,201,true,"Notice created successfully",data);
});

exports.getNotices=asyncHandler(async (req,res)=>{
    const {items,meta}=await noticeServices.getNotices(req);
    res.status(200).json({
        success:true,
        message:"Notices fetched successfully",
        data:items,
        meta,
    });
});

exports.getNoticeById=asyncHandler(async (req,res)=>{
    const data=await noticeServices.getNoticeById(req.params.id);
    sendResponse(res,200,true,"Notice fetched successfully",data);
});

exports.updateNotice=asyncHandler(async (req,res)=>{
    const data=await noticeServices.updateNotice(req.params.id, req.body);
    sendResponse(res,200,true,"Notice updated successfully",data);
});

exports.deleteNotice=asyncHandler(async (req,res)=>{
    await noticeServices.deleteNotice(req.params.id);
    sendResponse(res,200,true,"Notice deleted successfully");
});
