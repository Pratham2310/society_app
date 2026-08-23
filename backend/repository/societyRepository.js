const logger = require("../utils/logger");
const Society = require("../models/Society");

// A salesperson sees the societies they onboarded. A superadmin owns
// the platform and must see all of them — passing null for the owner
// means "no ownership filter", which is what makes that possible
// without a second set of methods.
const ownedBy = (userId) => (userId ? { createdBy: userId } : {});

class SocietyRepository {

  async countBySalesperson(userId) {
    return Society.countDocuments(ownedBy(userId));
  }

  async getRecentSociety(userId) {
    return Society.find(ownedBy(userId))
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name city societyCode createdAt");
  }

  async getAllBasicSociety(userId) {
    return Society.find(ownedBy(userId))
      .select("name city societyCode");
  }

  async findByIdAndSalesperson(id, userId) {
    return Society.findOne({ _id: id, ...ownedBy(userId) });
  }
  async getSocietiesWithPagination(userId, { page, limit, search }) {

  const skip = (page - 1) * limit;

  let filter = { ...ownedBy(userId) };

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
    logger.debug({ userId, societyId: soceityId }, "checking society membership");
      return Society.findOne({ _id: soceityId, ...ownedBy(userId) });

  }
}

module.exports = new SocietyRepository();