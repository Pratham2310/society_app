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
      societyrole: "member",          // correct field
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
      societyrole:"security",
    }).select("name isVerified createdAt");
  }

  async getStaffBySociety(societyId,limit=4)
  {
    return User.find({
      societyId,
      societyrole:"staff"
    }).select("name staffCategory flatNumber entryTime")
    .sort({createdAt:-1})
    .limit(limit);
  }

  async getAllStaff(societyId,{page, limit,search,category})
  {
    const skip=(page-1)*limit;
    let filter={
      societyId,
      societyrole:"staff"
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
  //     soceityrole:{
  //       $in:["secretary","chairman","treasurer","comitee-member"]
  //     }
  //   }).select("name societyrole");
  // }
  async getLeadershipBySociety(societyId) {

  

  const result = await User.find({
    societyId: societyId,
    societyrole: {
      $in: ["secretary", "chairman", "treasurer", "comitee-member"]
    }
  }).select("name societyrole");

  

  return result;
}
}

module.exports = new UserRepository();