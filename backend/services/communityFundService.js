const repo=require("../repository/communityFundRepository");
const mongoose=require("mongoose");
const AppError=require("../utils/appError");


//create fund(secretary)
exports.createFund=async(req)=>{
    return await repo.createFund({
        ...req.body,
        societyId:req.user.societyId,
        createdBy:req.user.id
    });
};


//get fund
exports.getFunds=async(req)=>{
    return await repo.findFunds({
        societyId:new mongoose.Types.ObjectId(req.user.societyId)
    });
};

//contribute
exports.contribute=async(fundId,req)=>{
    return await repo.createContribution({
        fundId,
        userId:req.user.id,
        amount:req.body.amount,
        proof:req.body.proof
    });
};


//approve reject
exports.approveContribution=async(id,status,req)=>{
    const contribution=await repo.findContributionById(id);
    if(!contribution) throw new AppError("contribution not found",404);

    if(contribution.status !== "pending")throw new AppError("contribution already processed",400);
    contribution.status=status;

    //if approved update fund
    if(status==="approved"){
        const fund=await repo.findById(contribution.fundId);
        fund.collectedAmount+=contribution.amount;
        await fund.save();
    }
    await contribution.save();
    return contribution;
};