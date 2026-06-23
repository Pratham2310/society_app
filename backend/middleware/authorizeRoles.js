const AppError=require("../utils/appError");

module.exports=(...roles)=>{
    return (req,res,next)=>{
        const userRole=req.user.role|| req.user.soccietyRole;

        if(!roles.includes(userRole)){
            return next(new AppError("You do not have permission to perform this action",403));
        }

    }
    next();
}