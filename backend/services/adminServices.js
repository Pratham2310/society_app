const bcrypt=require("bcrypt");
const AppError=require("../utils/appError");
const userRepository=require("../repository/userRepository");


exports.createSalesperson=async(data,createdByUser)=>{
    const {name,email,password,phone}=data;

    const existingUser=await userRepository.findByEmail(email);
    if(existingUser){
        throw new AppError("Email already in use",400);
    }
    const hashedPassword = await bcrypt.hash(password,10);

    const salesPerson=await userRepository.createUser({
        name,
        email,
        password:hashedPassword,
        phone,
        systemRole:"salesperson",
        createdBy:createdByUser.id
    });

    return salesPerson;
};

exports.createSuperAdmin=async(data)=>{
    const {name,email,password,phone}=data;
    const existingUser=await userRepository.findByEmail(email);
    if(existingUser)
    {
        throw new AppError("superadmin with this email already exists",400);
    }
    const hashedPassword=await bcrypt.hash(password,10);
    const superAdmin=await userRepository.createUser({
        name,
        email,
        password:hashedPassword,
        phone,
        systemRole:"superadmin"
    });
    return superAdmin;
}

// =======================================================
// LIST SALESPEOPLE
//
// A roster is only useful with the number that matters next to each
// name, so this joins in how many societies each one has onboarded
// rather than making the console fetch that per row.
// =======================================================

exports.listSalespeople = async () => {

    const User = require("../models/User");

    return User.aggregate([

        { $match: { systemRole: "salesperson" } },

        {
            $lookup: {
                from: "societies",
                localField: "_id",
                foreignField: "createdBy",
                as: "societies",
            },
        },

        {
            $project: {
                name: 1,
                email: 1,
                phone: 1,
                status: 1,
                createdAt: 1,
                societiesOnboarded: { $size: "$societies" },
                // Never project password or OTP material, even though
                // both are select:false — an aggregation ignores that.
            },
        },

        { $sort: { createdAt: -1 } },

    ]);

};
