const noticeServices=require("../services/noticeService");

exports.createNotice=async (req,res)=>{
    try{
        // console.log("create notice hit");
        // console.log("BODY",req.body);
        // console.log("USER",req.user);
        const data=await noticeServices.createNotice(req);
        res.json({success:true,data});
    }catch(err){
        // console.error("FULL ERROR",err);
        // console.error("ERROR MESSAGE",err.message);
        res.status(500).json({message:err.message});
    }
};

exports.getNotices=async (req,res)=>{
    try{
        const data=await noticeServices.getNotices(req);
        res.json({success:true,data});
    }catch(err){
        res.status(500).json({message:err.message});
    }
};

exports.getNoticeById=async (req,res)=>{
    try{
        const data=await noticeServices.getNoticeById(req.params.id);
        res.json({success:true,data});
    }catch(err){
        res.status(500).json({message:err.message});
    }
};

exports.updateNotice=async (req,res)=>{
    try{
        const data=await noticeServices.updateNotice(req.params.id, req.body);
        res.json({success:true,data});
    }catch(err){
        res.status(500).json({message:err.message});
    }
};

exports.deleteNotice=async (req,res)=>{
    try{
        await noticeServices.deleteNotice(req.params.id);
        res.json({success:true,message:"Notice deleted successfully"});
    }catch(err){
        res.status(500).json({message:err.message});
    }
};