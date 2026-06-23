const { create } = require("../models/Society");
const wing = require("../models/Wing");
const flat = require("../models/Flats");

const societyRepository = require("../repository/societyRepository");
const userRepository = require("../repository/userRepository");
const societyServiceRepository = require("../repository/societyServiceRepository"); 

const User = require("../models/User");
const AppError = require("../utils/appError");


class SalesServices{
    async getDashboardData(userId){
        const [
            totalSocieties,
            totalVerifiedMembers,
            recentSocieties,
        ]=await Promise.all([societyRepository.countBySalesperson(userId),
            userRepository.countVerifiedMembers(userId),
            societyRepository.getRecentSociety(userId)
        ]);

        return {
            totalSocieties,
            totalVerifiedMembers,
            recentSocieties 
        };
    }

    async getAllSocieties(userId,query){
        const page=parseInt(query.page)||1;
        const limit=parseInt(query.limit)||10;
        const search=query.search||"";
        const result=await societyRepository.getSocietiesWithPagination(userId,{page,limit,search});
        return {
            societies:result.data,
            pagination:{
                total:result.total,
                page,
                limit,
                totalPages:Math.ceil(result.total/limit)
            }
        }
    };
    async getSocietyDetails(userId,soceityId){
        const society=await societyRepository.getSocietyDetails(userId,soceityId);
        if(!society){
            throw new Error("soceity not found or access denied");
        }
        const [totalWing,totalFlats]=await Promise.all([
            wing.countDocuments({societyId:soceityId}),
            flat.countDocuments({societyId:soceityId})
        ]);
        return{
            _id:society._id,
            name:society.name,
            address:society.address,
            city:society.city,
            state:society.state,
            pincode:society.pincode,
            societyCode:society.societyCode,
            createdAt:society.createdAt,
            stats:{
                totalWings: totalWing,
                totalFlats
            }
        };
    }
    async getResidents(UserId,societyId,query={})
    {
        //security check 
        const society = await societyRepository.getSocietyDetails(UserId,societyId);

        if(!society)
        {
            throw new Error("Unauthorized or society not found");
        }
        const page=parseInt(query.page)||1;
        const limit=parseInt(query.limit)||4;
        const result= await userRepository.getResidentsBySociety(societyId,{page,limit});

        return {
            residents:result.data,
            pagination:{
                total:result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total/limit)
            }
        };
    }

    async getSecurityPersonnel(userId,societyId)
    {
        const society=await societyRepository.getSocietyDetails(userId,societyId);
        if(!society)
        {
            throw new AppError("Unauthorized or society not found");
        }

        const gaurds=await userRepository.getSecurityBySociety(societyId)
        //map ui format
        return gaurds.map(g=>({
            _id:g.id,
            name:g.name,
            shift:"Day",
            post:"Main Gate",
            status:g.isVerified?"verified":"probation"
        }));
    }

    async getStaffPreview(userId,societyId,query={})
    {
        const society= await societyRepository.getSocietyDetails(userId,societyId)
        if(!society)
        {
            throw new AppError("society not found or unauthorized")
        }

        const limit=parseInt(query.limit)||4;
        const staff = await userRepository.getStaffBySociety(societyId,limit);
        return staff.map(s=>({
            _id:s.id,
            name:s.name,
            category:s.staffCategory,
            flatNumber:s.flatNumber,
            entryTime:s.entryTime || "N/A"
        }));

    }
    async getAllStaff(userId,societyId,query={})
    {
        const society=await societyRepository.getSocietyDetails(userId,societyId)

        if(!society)
        {
            throw new AppError("unauthorized or society not found");
        }
        const page=parseInt(query.page)||1;
        const limit=parseInt(query.limit)||5;
        const search=query.search||"";
        const category=query.category||"";

        const result=await userRepository.getAllStaff(societyId,{page,limit,search,category});
        return {
            staff:result.data.map(s=>({
                _id:s.id,
                name:s.name,
                category:s.staffCategory,
                flatNumber:s.flatNumber,
                entryTime:s.entryTime || "N/A"
            })),
            pagination:{
                total:result.total,
                page,
                limit,
                totalPages:Math.ceil(result.total/limit)
            }
        };
    }

    // async getLeadership(userId,societyId)
    // {
    //     console.log("👉 Incoming societyId:", societyId);
    //     const society= await societyRepository.getSocietyDetails(userId,societyId)
    //     if(!society)
    //     {
    //         throw new AppError("unauthorized or society not found");
    //     }
    //     const leaders=await userRepository.getLeadershipBySociety(societyId)
    //     return leaders.map(l=>({
    //         _id:l.id,
    //         name:l.name,
    //         role:l.societyrole
    //     }));
    // }

    async getLeadership(userId, societyId) {

        const society = await societyRepository.getSocietyDetails(userId, societyId);

        if (!society) {
            throw new Error("Unauthorized or society not found");
        }

        const leaders = await userRepository.getLeadershipBySociety(societyId);

        return leaders.map(l => ({
            _id: l._id,
            name: l.name,
            role: l.societyrole
        }));
    }


    async getServices(userId, societyId) {

    const society = await societyRepository.getSocietyDetails(userId, societyId);

    if (!society) {
        throw new AppError("unauthorized or society not found");
    }

    const services = await societyServiceRepository.getBySociety(societyId);

    return services.map(item => ({
        _id: item.serviceId._id,
        name: item.serviceId.name,
        type: item.serviceId.type,
        timing: item.serviceId.timing,
        phone: item.serviceId.phone
    }));
}
}

module.exports=new SalesServices(); 