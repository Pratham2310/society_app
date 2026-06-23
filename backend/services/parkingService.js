const repo=require("../repository/parkingRepository");
const mongoose=require("mongoose");
const AppError=require("../utils/appError");

//===========create slot===========

//secretayr only
exports.createSlot=async(req)=>{
    const {slotNumber,type,wingId}=req.body;

    if(!slotNumber || !type){
        throw new AppError("slot number and type are required",400);
    }

    return await repo.createSlot({
        societyId:new mongoose.Types.ObjectId(req.user.societyId),
        slotNumber,
        type,
        wingId:wingId?new mongoose.Types.ObjectId(wingId):null
    });
};


//===========get parking map===========
exports.getParkingMap=async(req)=>{
    const slot=await repo.getSlots({societyId:req.user.societyId});
    //ai ready format
    return slot.map(slot => ({
        _id: slot._id,
        slotNumber: slot.slotNumber,
        type: slot.type,
        status: slot.status,
        vehicle: slot.vehicleNumber
    }));
}

//===========assign slot===========

exports.assignSlot=async(slotId,req)=>{
    const {flatId,vehicleNumber,vehicleType,ownerId}=req.body;

    if(!flatId || !vehicleNumber || !vehicleType || !ownerId)
    {
        throw new AppError("All fields are required",400);
    }
    const slot=await repo.getSlotById(slotId);
    if(!slot){
        throw new AppError("slot not found",404);
    }
    if(slot.status==="occupied"){
        throw new AppError("slot already occupied",400);
    }

    //create allotment
    const allotment=await repo.createAllotment({
        societyId,
        slotId:new mongoose.Types.ObjectId(slotId),
        flatId,
        vehivleNumber,
        vehivleType,
        ownerId
    });

    //update slot
    await repo.updateSlot(slotId,{status:"occupied",vehicleNumber,lastUpdated:new Date()});
    return allotment;
};

//===========free slot===========

exports.freeSlot=async(slotId)=>{
    const allotment=await repo.getActiveAllotmentBySlotId(slotId);
    if(!allotment){
        throw new AppError("No active allotment found for this slot",404);
    }

    //deactivate allotment
    await repo.deactivateAllotment(allotment._id);

    //update slot
    await repo.updateSlot(slotId,{status:"free",currentVehicleNumber:null,lastUpdated:new Date()});
    return {message:"slot freed successfully"};
};


//=========find owner=============
exports.findOwner=async(vehicleNumber)=>{
    if(!vehicleNumber){
        throw new AppError("Vehicle number is required",400);
    }

    const result=await repo.findOwnerByVehicleNumber(vehicleNumber);
    if(!result){
        throw new AppError("No vehicle found",404);
    }
    return {
        ownerName:result.ownerName,
        ownerId:result.ownerId,
        slot:result.slotId,
        vehicleNumber:result.vehicleNumber
    };
};

//===========my parking============

exports.myParking=async(req)=>{
    const allotment=await repo.getUserAllotment(req.user._id);
    if(!allotment){
        return null;
    }
    return {
        slotNumber:allotment.slotId.slotNumber,
        vehicleNumber:allotment.vehicleNumber
    };
};


//=============slot details (wrong parking check)==============
exports.getSlotDetails=async(slotId)=>{
    const slot=await repo.getSlotById(slotId);
    if(!slot){
        throw new AppError("slot not found",404);
    }
    const allotment=await repo.getActiveAllotmentBySlotId(slotId);

    let isWrong=false;
    if(allotment && allotment.vehicleNumber && allotmenr.vehicleNumber !== slot.vehicleNumber){
        isWrong=true;
    }

    return {
        slot,
        allotmentVehicle:allotment?.vehicleNumber || null,
        currentVehcile:slot.vehicleNumber,
        isWrong
    };
};