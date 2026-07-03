const guestPass=require("../models/GuestPass");

//create
exports.create=(data,session=null)=>{
  return guestPass.create([data],{session:session}).then((docs)=>docs[0]);
}

//==================================
//Read
//==================================

//find by id
exports.findById=(id,societyId)=>{
  return guestPass.findOne({_id:id,societyId})
  .populate("residentId", "name phone profilePicture")
  .populate("flatId", "flatNumber")
  .populate("wingId","name")
  .populate("societyId","name");
};


//find by qr token
exports.findByToken=(qrToken,societyId)=>{
  return guestPass.findOne({Token:qrToken,societyId,status:"active"});
};

//resident Passes
exports.findByResident=(residentId,societyId)=>{
  return guestPass.find({residentId,societyId}).sort({createdAt:-1});
};


//soietyPasses
exports.findBySociety=(societyId)=>{
  return guestPass.find({societyId}).sort({creaatedAt:-1});
};

//generic find
exports.findAll=(filter={},options={})=>{
  const {
    page=1,
    limit=10,
    sort={createdAt:-1},
  }=options;
  return guestPass.find(filter)
  .sort(sort)
  .skip((page-1)*limit)
  .limit(limit);
};

// =======================================================
// SEARCH
// =======================================================


//search guest

exports.searchGuest=(societyId,keyword)=>{
  return guestPass.find({
    societyId,
    $or:[
      {guestName:{$regex:keyword,$options:"i"},},
      {guestPhone:{$regex:keyword,$options:"i"},},
      {vehicleNumber:{$regex:keyword,$options:"i"},},
    ]
  }).sort({createdAt:-1});
};

// =======================================================
// EXISTS
// =======================================================

exports.exists = (
  id,
  societyId
) => {
  return GuestPass.exists({
    _id: id,
    societyId,
  });
};


// =======================================================
// FILTERS
// =======================================================

//find by status

exports.findByStatus = (societyId,status,options={})=>{
  const {page=1,
    limit=10,
    sort={createdAt:-1}
  }=options;
  return guestPass.find({societyId,status,}).sort({createdAt:-1}).skip((page-1)*limit).limit(limit);
};


//find by pass type
exports.findByPassType = (societyId,passType,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;
  return guestPass.find({
    societyId,
    passType,
  }).sort({createdAt:-1})
  .skip((page-1)*limit)
  .limit(limit);
};


//find by purpose
exports.findByPurpose=(societyId,purpose,options={})=>{
  const {page=1,
    limit=10
  }=options;
  return guestPass.find({
    societyId,
    purpose,
  }).sort({createdAt:-1})
  .skip((page-1)*limit)
  .limit(limit);
};

//find between dates
exports.findBetweenDates=(societyId,startDate,endDate,options={})=>{
  const{
    page=1,
    limit=10
  }=options;

  return guestPass.find({
    societyId,
    createdAt:{
      $gte:startDate,
      $lte:endDate
    },
  });
};


//Find expiring soon
exports.findExpiringSoon=(societyId,date,options={})=>{
  const {
    page=1,
    limit=10
  }=options;

  return guestPass.find({
    societyId,
    status:"active",
    expiryDate:{
      $lte:date,
    },
  });
};


//find expired
exports.findExpired=(societyId)=>{
  return guestPass.find({
    societyId,
    status:"expired"
  }).sort({expiryDate:-1});
};

//find recent 

exports.findRecent=(societyId,limit=10)=>{

  return guestPass.find({
    societyId,
  }).sort({createdAt:-1})
  .limit(limit);
};


// =======================================================
// REPORTS
// =======================================================


//Resident history
exports.findResidentHistory=(societyId,residentId,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;

  return giestPass.find({
    societyId,
    residentId,
  }).sort({createdAt:-1});

};

//flat history
exports.findFlatHistory=(societyId,flatId,options={})=>{
  const {
    page=1,
    limit=10
  }=options;
  return guestPass.find({
    societyId,
    flatId,
  }).sort({createdAt:-1});
};

//wing history
exports.findWingHistory=(societyId,wingId,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;

  return guestPass.find({
    societyId,
    wingId,
  }).sort({createdAt:-1});
};

//todays passes
exports.findTodaysPasses=(societyId,startofDay,endofDay)=>{
  return guestPass.find({
    societyId,
    createdAt:{
      $gte:startofDay,
      $lte:endofDay,
    },
  }).sort({createdAt:-1});
};


//permenant passes
exports.findPermenantPasses=(societyId)=>{
  return guestPass.find({
    societyId,
    passType:"permanent",
  }).sort({createdAt:-1});
};


//multi time passes
exports.findMultiTimePasses=(societyId)=>{
  return guestPass.find({
    societyId,
    passType:"multi-time",
  }).sort({createdAt:-1});
};


//one time passes
exports.findOneTimePasses=(societyId)=>{
  return guestPass.find({
    societyId,
    passType:"one time",
  }).sort({createdAt:-1});
};

// =======================================================
// UPDATE METHODS
// =======================================================

// Update QR Information
exports.updateQRCode = (
  id,
  societyId,
  data
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        qrCode: data.qrCode,
        qrToken: data.qrToken,
        lastQrGeneratedAt: new Date(),
      },

      $inc: {
        regeneratedCount: 1,
        qrVersion: 1,
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// UPDATE PASS STATUS
// =======================================================

exports.updatePassStatus = (
  id,
  societyId,
  status,
  reason,
  changedBy
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        status,
        statusReason: reason,
      },

      $push: {
        statusHistory: {

          previousStatus: "$status",

          newStatus: status,

          reason,

          changedBy,

          changedAt: new Date(),

        },
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// APPROVE PASS
// =======================================================

exports.approvePass = (
  id,
  societyId,
  approvedBy
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        approvedBy,
        approvedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// UPDATE LAST SCAN
// =======================================================

exports.updateLastScanned = (
  id,
  societyId
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        lastScannedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// EXTEND PASS
// =======================================================

exports.extendPass = (
  id,
  societyId,
  expiryDate,
  history
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        expiryDate,
      },

      $push: {
        extensionHistory: history,
      },

      $inc: {
        extendedCount: 1,
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// UPDATE NOTIFICATION
// =======================================================

exports.updateNotificationTime = (
  id,
  societyId
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        lastNotificationSentAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// UPDATE METADATA
// =======================================================

exports.updateMetadata = (
  id,
  societyId,
  metadata
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        metadata,
      },
    },
    {
      new: true,
    }
  );

};







