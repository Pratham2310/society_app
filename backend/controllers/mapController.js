const mapService= require("../services/mapServices");
const {serviceFilterSchema}=require("../validation/mapValidation");

//============GET SERVICES==========
exports.getSocietyServices=async(req,res)=>{
    try{
        const {error}=serviceFilterSchema.validate(req.query);
        if(error){
            return res.status(400).json({success:false,error:error.details[0].message});
        }
        const data=await mapService.getSocietyServices(req);
        res.status(200).json({success:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({success:false,error:err.message});
    }
};

//============get SINGLE==========
exports.getServiceDetails=async(req,res)=>{
    try{
        const data=await mapService.getSerivceDetails(req.params.id);
        res.status(200).json({success:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({success:false,error:err.message});
    }
};

//============TOGGLEVISIBILITY=============
exports.toggleVisibility=async(req,res)=>{
    try{
        const data=await mapService.toggleVisibility(req.params.id,req);
        res.status(200).json({success:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({success:false,error:err.message});
    }
};