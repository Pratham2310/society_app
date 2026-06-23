const salesServices = require("../services/salesServices");
const salesService = require("../services/salesServices");

exports.getDashboard = async (req,res)=>{
    try{
        const data =await salesService.getDashboardData(req.user.id)
        res.json({success:true,data});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllSocieties=async(req,res)=>{
    try{
        const data = await salesService.getAllSocieties(req.user.id);
        res.json({success:true,data});
    }catch(error)
    {
        res.status(500).json({error:error.message});
    }
};

exports.getSocities=async(req,res)=>{
    try{
        const data = await salesService.getAllSocieties(req.user.id,req.query);
        res.json({success:true,data});
    }catch(error)
    {
        res.status(500).json({success:false,error:error.message});
    }
};

exports.getSocietyDetails=async(req,res)=>{
    try{
        const data= await salesService.getSocietyDetails(req.user.id,req.params.id);
        res.json({success:true,data});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
};  

exports.getResidents= async(req,res)=>{
    try{
        const data= await salesService.getResidents(
            req.user.id,
            req.params.id,
            req.query
        );
        res.json({
            success:true,
            data
        });
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
}

exports.getSecurityPersonnel = async (req,res)=>{
    try{
        const data= await salesService.getSecurityPersonnel(req.user.id,req.params.id);
        res.json({
            success:true,
            data
        });
    }catch(error)
    {
        res.status(500).json({success:false,error:error.message});
    }
}

exports.getStaffPreview=async(req,res)=>{
    try{
        const data=await salesService.getStaffPreview(req.user.id,
            req.params.id,req.query
        );
        res.json({success:true,data});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
}

exports.getAllStaff=async(req,res)=>{
    try{
        const data=await salesService.getAllStaff(req.user.id,req.params.id,req.query);
        res.json({success:true,data});
    }catch(error)
    {
        res.status(500).json({success:false,error:error.message});
    }
}

exports.getLeadership=async(req,res)=>{
    try{
        const data=await salesService.getLeadership(req.user.id,req.params.id);
        res.json({
            success:true,
            data
        });
    }catch(error)
    {
        res.status(500).json({success:false,error:error.message});
    }
}

exports.getServices=async(req,res)=>{
    try{
        const data=await salesService.getServices(
            req.user.id,
            req.params.id
        );
        res.json({
            success:true,
            data
        });
    }catch(error)
    {
        res.status(500).json({success:false,error:error.message});
    }
};