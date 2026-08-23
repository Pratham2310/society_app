const noticeRepo=require("../repository/noticeRepository");
const AppError=require("../utils/appError");
const {getPagination,buildPage}=require("../utils/pagination");

exports.createNotice=async(req)=>{
    return await noticeRepo.createNotice({
        ...req.body,
        societyId:req.user.societyId,
        createdBy:req.user.id
    });
};

exports.getNotices=async (req)=>{
    const {type,urgent}=req.query;

    let filter={
        societyId:req.user.societyId,
        status:"published"
    };

    if(type) filter.type=type;
    if(urgent)filter.isUrgent=urgent==="true";

    const pagination=getPagination(req.query);

    const rows=await noticeRepo.findPage(filter,pagination);

    //Only the web console needs a total; the mobile list scrolls.
    const total=pagination.mode==="offset"
        ? await noticeRepo.countAll(filter)
        : null;

    return buildPage(rows,pagination,total);
};


exports.getNoticeById=async (id)=>{
    const notice=await noticeRepo.findById(id);

    if(!notice){
        throw new AppError("Notice not found",404);
    }
    return notice;
};


exports.updateNotice=async (id,data)=>{
    const updated=await noticeRepo.updateNotice(id,data);

    //A scoped query that matches nothing returns null. Without this
    //check a cross-society update reports success while changing
    //nothing, which is worse than an honest 404.
    if(!updated){
        throw new AppError("Notice not found",404);
    }

    return updated;
};


exports.deleteNotice=async (id)=>{
    const deleted=await noticeRepo.deleteNotice(id);

    if(!deleted){
        throw new AppError("Notice not found",404);
    }

    return deleted;
};