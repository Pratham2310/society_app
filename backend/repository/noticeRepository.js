const noticeModel=require("../models/Notice");

exports.createNotice=(noticeData)=>noticeModel.create(noticeData);

exports.findAll=(filter,limit)=>{
    return noticeModel.find(filter).sort({createdAt:-1}).limit(limit).lean();
};

exports.findById=(id)=>noticeModel.findById(id);

exports.updateNotice=(id,updateData)=>noticeModel.findByIdAndUpdate(id,updateData,{new:true});

exports.deleteNotice=(id)=>noticeModel.findByIdAndDelete(id);