const Complaint= require("../models/Complaint");

exports.Create=(data)=>{
    return Complaint.create(data);
};

const {applyPagination}=require("../utils/pagination");

//This previously had no return statement, so complaint listing
//always resolved to undefined.
exports.findPage=(filter,pagination)=>{
    return applyPagination(Complaint.find(filter),pagination).lean();
};

exports.countAll=(filter)=>Complaint.countDocuments(filter);

exports.findById=(id)=>Complaint.findById(id);

exports.update=(id,data)=>{
    Complaint.findByIdAndUpdate(id,data,{new:true});
}

exports.delete=(id)=>Complaint.findByIdAndDelete(id);