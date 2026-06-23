const Society = require("../models/Society");

class SocietyRepository {

  async countBySalesperson(userId) {
    return Society.countDocuments({ createdBy: userId });
  }

  async getRecentSociety(userId) {
    return Society.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name city societyCode");
  }

  async getAllBasicSociety(userId) {
    return Society.find({ createdBy: userId })
      .select("name city societyCode");
  }

  async findByIdAndSalesperson(id, userId) {
    return Society.findOne({
      _id: id,
      createdBy: userId
    });
  }
  async getSocietiesWithPagination(userId, { page, limit, search }) {

  const skip = (page - 1) * limit;

  let filter = { createdBy: userId };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } }
    ];
  }

  const [data, total] = await Promise.all([
    Society.find(filter)
      .select("name city societyCode")
      .sort({ createdAt: -1 })   // ✅ FIXED
      .skip(skip)
      .limit(limit),

    Society.countDocuments(filter)
  ]);

    return { data, total };
  }
  async getSocietyDetails(userId,soceityId){
    console.log("👉 Checking society with:");
    console.log("userId:", userId);
    console.log("societyId:", soceityId);
    //console.log("👉 Society result:", result);
      return Society.findOne({
          _id:soceityId,
          createdBy:userId
      });

  }
}

module.exports = new SocietyRepository();