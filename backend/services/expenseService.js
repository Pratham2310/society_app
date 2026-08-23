const repo=require("../repository/expenseRepository");
const mongoose=require("mongoose");
const AppError=require("../utils/appError");

//create expense

exports.createExpense=async(req)=>{
    const expense=await repo.create({
        ...req.body,
        societyId:new mongoose.Types.objectId(req.user.societyId),
        createdBy:req.user.id
    });

    return expense.toObject();
};

//get expense
exports.getExpense=async(req)=>{
    const isAdmin=[
        "secretary",
        "chairman",
        "treasurer",
        "committee_member"
    ].includes(req.user.societyRole);

    let filter={
        societyId:new mongoose.Types.objectId(req.user.societyId)
    };

    //resident view 
    if(!isAdmin){
        filter.ispublished=true;
        filter.visibleToResidents=true;
    }

    return await repo.findAll(filter);
};

//publish expense
exports.publishExpense=async(req)=>{
    const expense=await repo.findById(req.user.id);
    if(!expense){
        throw new AppError("Expense not found",404);
    }
    expense.isPublished=true;
    await expense.save();
    return expense.toObject();
};

//toggele visibility
exports.toggleVisibility=async(id,visible,req)=>{
    const expense=await repo.findById(id);
    if(!expense) throw new AppError("Expense not found",404);

    expense.visibleToResidents=visible;
    await expense.save();
    return expense.toObject();

}
