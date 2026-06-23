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