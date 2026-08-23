const User=require("../models/User");
const mongoose=require("mongoose");

//find by email
exports.findByEmail=(email)=>{
    return User.findOne({email});
};

//find by phone
exports.findByPhone=(phone)=>{
    return User.findOne({phone});
};

//find by id
exports.findById=(id)=>{
    return User.findById(id);
};

//create user
exports.createUser=(userData)=>{
    return User.create(userData);
};

//generic query

exports.getUsers=(filter)=>{
    return User.find(filter).select("-password").lean();
}


class UserRepository {

  async countVerifiedMembers(userId) {
    return User.countDocuments({
      createdBy: userId,              // 🔥 important
      societyRole: "member",          // correct field
      isVerified: true
    });
  };

  async getResidentsBySociety(societyId,{page,limit})
  {
    const skip=(page-1)*limit;

    const [data,total]=await Promise.all([
        User.find({societyId})
        .select("name flatNumber createdAt occupancyType isVerified livingType vehicles")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),

        User.countDocuments({societyId})
    ]);
    return {data,total};
  }

  async getSecurityBySociety(societyId)
  {
    return User.find({
      societyId,
      societyRole:"security",
    }).select("name isVerified createdAt");
  }

  async getStaffBySociety(societyId,limit=4)
  {
    return User.find({
      societyId,
      societyRole:"staff"
    }).select("name staffCategory flatNumber entryTime")
    .sort({createdAt:-1})
    .limit(limit);
  }

  async getAllStaff(societyId,{page, limit,search,category})
  {
    const skip=(page-1)*limit;
    let filter={
      societyId,
      societyRole:"staff"
    };

    if(search)
    {
      filter.$or=[
        { name: { $regex: search, $options: "i" } },
        { flatNumber: { $regex: search, $options: "i" } }
      ];
    }
    if(category)
    {
      filter.staffCategory=category;
    }
    const [data,total]=await Promise.all([
      User.find(filter)
      .select("name staffCategory flatNumbre enteryTime")
      .sort({createdAt:-1})
      .skip(skip)
      .limit(limit),
      User.countDocuments(filter)
    ]);
    return {data,total};
  }

  // async getLeadershipBySociety(societyId)
  // {
  //   console.log("👉 Repo societyId:", societyId);
  //   return User.find({
  //     societyId: new mongoose.Types.ObjectId(societyId),
  //     societyRole:{
  //       $in:["secretary","chairman","treasurer","committee_member"]
  //     }
  //   }).select("name societyRole");
  // }
  async getLeadershipBySociety(societyId) {

  

  const result = await User.find({
    societyId: societyId,
    societyRole: {
      $in: ["secretary", "chairman", "treasurer", "committee_member"]
    }
  }).select("name societyRole");

  

  return result;
}
}

// The five exports.* helpers above were being discarded: assigning to
// module.exports replaces the object they were attached to, so
// findByEmail, findByPhone, findById, createUser and getUsers all
// resolved to undefined. That is why creating a salesperson failed with
// "userRepository.findByEmail is not a function".
//
// Merging keeps both shapes working for existing callers.
module.exports = Object.assign(new UserRepository(), {
  findByEmail: exports.findByEmail,
  findByPhone: exports.findByPhone,
  findById: exports.findById,
  createUser: exports.createUser,
  getUsers: exports.getUsers,
});