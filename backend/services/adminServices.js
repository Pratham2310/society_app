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


// =======================================================
// UPDATE A SALESPERSON
//
// Contact details and account status only. Role is not editable here:
// turning a salesperson into a superadmin over HTTP would be the same
// escalation hole the public bootstrap route was.
// =======================================================

exports.updateSalesperson = async (salespersonId, data) => {

    const User = require("../models/User");

    const allowed = {};

    if (data.name !== undefined) allowed.name = data.name;
    if (data.phone !== undefined) allowed.phone = data.phone;

    // "rejected" is the schema's word for a disabled account. Suspending
    // beats deleting for someone who has onboarded societies — the
    // societies keep their owner, but the person cannot sign in.
    if (data.status !== undefined) {
        if (!["approved", "rejected"].includes(data.status)) {
            throw new AppError("Status must be approved or rejected", 400);
        }
        allowed.status = data.status;
    }

    if (data.email !== undefined) {
        const clash = await User.findOne({
            email: data.email,
            _id: { $ne: salespersonId },
        });
        if (clash) {
            throw new AppError("Email already in use", 409);
        }
        allowed.email = data.email;
    }

    const updated = await User.findOneAndUpdate(
        { _id: salespersonId, systemRole: "salesperson" },
        { $set: allowed },
        { new: true, runValidators: true }
    );

    if (!updated) {
        throw new AppError("Salesperson not found", 404);
    }

    return updated;

};


// =======================================================
// DELETE A SALESPERSON
//
// Refused while they still own societies. Removing the account would
// orphan every society whose createdBy points at it, and those
// societies drive the whole /sales view. Suspend instead.
// =======================================================

exports.deleteSalesperson = async (salespersonId) => {

    const User = require("../models/User");
    const Society = require("../models/Society");

    const salesperson = await User.findOne({
        _id: salespersonId,
        systemRole: "salesperson",
    });

    if (!salesperson) {
        throw new AppError("Salesperson not found", 404);
    }

    const owned = await Society.countDocuments({ createdBy: salespersonId });

    if (owned > 0) {
        throw new AppError(
            `This salesperson onboarded ${owned} ${owned === 1 ? "society" : "societies"}. ` +
            `Deleting the account would orphan them — suspend it instead.`,
            409
        );
    }

    await User.deleteOne({ _id: salespersonId });

    return { deleted: true };

};
