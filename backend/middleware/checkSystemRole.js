module.exports = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.systemRole)) {
            return res.status(403).json({message:"Access denied"});
        }
        console.log("CHECK ROLE:", req.user.systemRole);
        console.log("ALLOWED ROLES:", roles);
        next();
    };
};