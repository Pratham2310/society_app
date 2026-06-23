module.exports = (...roles) => {
    return (req, res, next) => {
        if(!req.user || !roles.includes(req.user.systemRole)){
            return res.status(403).json({message:"Access denied"});
        }
        next();
    };
};