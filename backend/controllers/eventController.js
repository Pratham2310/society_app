const logger = require("../utils/logger");
const eventService=require("../services/eventServices");

exports.createEvent= async(req,res)=>{
    try{
        const data=await eventService.createEvent(req);
        logger.debug({ eventId: data?._id }, "event created");
        res.json({success:true,data});
    }catch(error){
        res.status(error.statusCode || 500).json({success:false,error:error.message});
    }
};

exports.getEvents=async(req,res)=>{
    try{
        const data=await eventService.getEvent(req);
        res.json({success:true,data});
    }catch(error){
        res.status(error.statusCode || 500).json({success:false,error:error.message});
    }
};

exports.getEventById=async(req,res)=>{
    try{
        const data=await eventService.getEventById(req.params.id,req);
        res.json({success:true,data});
    }catch(error){
        res.status(error.statusCode || 500).json({success:false,error:error.message});
    }
};

exports.updateEvent=async(req,res)=>{
    try{
        const data=await eventService.updateEvent(req.params.id,req.body,req);
        res.json({success:true,data});
    }
    catch(error){
        res.status(error.statusCode || 500).json({success:false,error:error.message});
    }
};

exports.deleteEvent=async(req,res)=>{
    try{
        await eventService.deleteEvent(req.params.id,req);
        res.json({success:true,message:"event deleted successfully"});
    }
    catch(error){
        res.status(error.statusCode || 500).json({success:false,error:error.message});
    }
};

