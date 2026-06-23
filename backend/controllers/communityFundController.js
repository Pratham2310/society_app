const service=require("../services/communityFundService");
const {createSchema,contributionSchema,approvalSchema}=require("../validation/communityFundValidation");


//create fund
exports.createFund=async(req,res)=>{
    try{
        const {error}=createSchema.validate(req.body);
        if(error) return res.status(400).json({message:error.details[0].message});

        const data=await service.createFund(req);
        res.json({success:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({message:err.message});
    }
};


//get funds
exports.getFunds=async(req,res)=>{
    const data=await service.getFunds(req);
    res.json({success:true,data});
};

//contribute
exports.contribute=async(req,res)=>{
    try{
        const {error}=contributionSchema.validate(req.body);
        if(error) return res.status(400).json({messsage:error.details[0].message});

        const data=await service.contribute(req.params.id,req);
        res.json({succes:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({message:err.message});
    }
};


//approve reject
exports.approveContribution=async(req,res)=>{
    try{
        const {error}=approvalSchema.validate(req.body);
        if(error) return res.status(400).json({message:error.details[0].message});

        const data=await service.approveContribution(req.params.id,req.body.status,req);
        res.json({success:true,data});
    }catch(err){
        res.status(err.statusCode || 500).json({message:err.message});
    }
};

