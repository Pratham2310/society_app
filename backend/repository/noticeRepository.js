const noticeModel=require("../models/Notice");

exports.createNotice=(noticeData)=>noticeModel.create(noticeData);

const {applyPagination}=require("../utils/pagination");

//Returns limit+1 rows so the service can tell whether more exist
//without a second count query.
exports.findPage=(filter,pagination)=>{
    return applyPagination(noticeModel.find(filter),pagination).lean();
};

exports.countAll=(filter)=>noticeModel.countDocuments(filter);

exports.findById=(id)=>noticeModel.findById(id);

exports.updateNotice=(id,updateData)=>noticeModel.findByIdAndUpdate(id,updateData,{new:true});

exports.deleteNotice=(id)=>noticeModel.findByIdAndDelete(id);