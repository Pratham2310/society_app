const checkRole=(allowedRoles)=>{
    return (req,res,next)=>{
        if(!allowedRoles.includes(req.user.societyRole)){
            return res.status(403).json({message:"Access denied"});
        }
        next();
    };
};

module.exports=checkRole;