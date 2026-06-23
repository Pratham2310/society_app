const Complaint= require("../models/Complaint");

exports.Create=(data)=>{
    return Complaint.create(data);
};

exports.findAll=(filter)=>{
    Complaint.find(filter).sort({createdAt:-1}).lean();
}

exports.findById=(id)=>Complaint.findById(id);

exports.update=(id,data)=>{
    Complaint.findByIdAndUpdate(id,data,{new:true});
}

exports.delete=(id)=>Complaint.findByIdAndDelete(id);