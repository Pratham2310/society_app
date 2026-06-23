const noticeRepo=require("../repository/noticeRepository");
const AppError=require("../utils/appError");

exports.createNotice=async(req)=>{
    return await noticeRepo.createNotice({
        ...req.body,
        societyId:req.user.societyId,
        createdBy:req.user.id
    });
};

exports.getNotices=async (req)=>{
    const {type,urgent,limit=10}=req.query;

    let filter={
        societyId:req.user.societyId,
        status:"published"
    };

    if(type) filter.type=type;
    if(urgent)filter.isUrgent=urgent==="true";

    return await noticeRepo.findAll(filter,limit);
};


exports.getNoticeById=async (id)=>{
    const notice=await noticeRepo.findById(id);

    if(!notice){
        throw new AppError("Notice not found",404);
    }
    return notice;
};


exports.updateNotice=async (id,data)=>{
    return await noticeRepo.updateNotice(id,data);
};


exports.deleteNotice=async (id)=>{
    await noticeRepo.deleteNotice(id);
};