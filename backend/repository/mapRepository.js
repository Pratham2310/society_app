const SocietyService=require("../models/SocietyService");
const Service=require("../models/Service");

//==============Get Services============

exports.getSocietyServices=async(societyId, filter)=>{
    const societyServices=await SocietyService.find({societyId,isVisible:true})
    .populate({
        path:"serviceId",
        match:filter,
        select:"name category description image phone address openTime closeTime is24Hours lattitude longitude"
    })
    .lean();
};


//==============get single===========

exports.getServiceDetails=async(id)=>{
    return SocietyService.findById(id)
    .populate("serviceId")
    .lean();

};


//==============update visibility============
exports.updateVisibility=async(id,data)=>{
    return SocietyService.findByIdAndUpdate(id,{isVisible:data},{new:true});
};