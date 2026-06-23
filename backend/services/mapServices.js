const mongoose=require("mongoose");
const repo=require('../repository/mapRepository');


//=============GET SERVICES=============
exports.getSocietyServices=async(req)=>{
    const filter={};
    if(req.query.category){
        filter.category=req.query.category;
    }

    const services=await repo.getSocietyServices(new mongoose.Types.ObjectId(req.params.societyId),filter);
    //remove null populate ressults
    const filtered=services.filter(s=>s.serviceId!==null);
    //ui filtered
    return filtered.map(item=>({
        assignmentId:item._id,
        isRecommended:item.isRecommended,
        isEmergency:item.isEmergency,
        notes:item.notes,
        service:{_id:item.serviceId._id,
            name:item.serviceId.name,
            category:item.serviceId.category,
            description:item.serviceId.description,
            image:item.serviceId.image,
            phone:item.serviceId.phone,
            address:item.serviceId.address,
            openTime:item.serviceId.openTime,
            closeTime:item.serviceId.closeTime,
            is24Hours:item.serviceId.is24Hours,
            lattitude:item.serviceId.lattitude,
            Longitude:item.serviceId.Longitude
        }
    }));
};


//===========GET SINGLE==========
exports.getSerivceDetails=async(id)=>{
    const service=await repo.getServiceDetails(id);
    if(!service){
        throw new Error("Service not found");
    }
    return service;
};

//=============TOGGLE VISIBILITY==========
exports.toggleVisibility=async(id,req)=>{
    const allowedRoles=["secretayr","chairman","comitee-member"];
    if(!allowedRoles.includes(req.usersocietyRole)){
        throw new Error("Unauthorized");
    }

    const service=await repo.getServiceDetails(id);
    if(!service){
        throw new Error("Service not found");
    }

    return await repo.updateVisibility(id,{isVisible:!service.isVisible});
};

