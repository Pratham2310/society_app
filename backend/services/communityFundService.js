const repo=require("../repository/communityFundRepository");
const mongoose=require("mongoose");
const AppError=require("../utils/appError");
const {withTransaction}=require("../utils/transactionHelper");


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

    //findContributionById returns a lean object, so the previous
    //contribution.save() threw. Persist through the repository, and
    //keep the fund total and the contribution status in one
    //transaction so an approved contribution is never counted twice
    //or lost entirely.
    return withTransaction(async(session)=>{

        if(status==="approved"){
            await repo.incrementCollected(
                contribution.fundId,
                contribution.amount,
                session
            );
        }

        return repo.updateContribution(id,{status},session);

    });
};