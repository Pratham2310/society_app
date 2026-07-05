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

// =======================================================
// SAVE INITIAL QR CODE
// =======================================================

exports.saveInitialQRCode = (
  id,
  societyId,
  qrCode
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        qrCode,
        lastQrGeneratedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// REGENERATE QR CODE
// =======================================================

exports.regenerateQRCode = (
  id,
  societyId,
  qrToken,
  qrCode
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        qrToken,
        qrCode,
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

// =======================================================
// UPDATE PASS STATUS
// =======================================================


// =======================================================
// UPDATE PASS STATUS
// =======================================================

exports.updatePassStatus = (
  id,
  societyId,
  previousStatus,
  newStatus,
  reason,
 changedBy
) => {

  const updateData = {
    status: newStatus,
    statusReason: reason,
    isActive: newStatus === "active",
  };

  if (newStatus === "expired") {
    updateData.expiredAt = new Date();
  }

  if (newStatus === "cancelled") {
    updateData.cancelledAt = new Date();
    updateData.cancelledBy = changedBy;
  }

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: updateData,

      $push: {
        statusHistory: {
          previousStatus,
          newStatus,
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
// FIND BY QR TOKEN + ACTIVE
// =======================================================

exports.findValidQRCode = (
  societyId,
  qrToken
) => {

  return GuestPass.findOne({
    societyId,
    qrToken,
    status: "active",
    isActive: true,
  });

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

// =======================================================
// ANALYTICS
// =======================================================

// Count By Status
exports.countByStatus = (
  societyId,
  status
) => {

  return GuestPass.countDocuments({
    societyId,
    status,
  });

};

// Count By Pass Type
exports.countByPassType = (
  societyId,
  passType
) => {

  return GuestPass.countDocuments({
    societyId,
    passType,
  });

};

// Count By Resident
exports.countByResident = (
  societyId,
  residentId
) => {

  return GuestPass.countDocuments({
    societyId,
    residentId,
  });

};

// Count Expiring Soon
exports.countExpiringSoon = (
  societyId,
  date
) => {

  return GuestPass.countDocuments({

    societyId,

    status: "active",

    expiryDate: {
      $lte: date,
    },

  });

};

// Count Total Passes
exports.countTotal = (
  societyId
) => {

  return GuestPass.countDocuments({
    societyId,
  });

};

// =======================================================
// UTILITIES
// =======================================================

// Exists By QR Token
exports.existsByToken = (
  token,
  societyId
) => {

  return GuestPass.exists({
    qrToken: token,
    societyId,
  });

};

// Exists By Id
exports.existsById = (
  id,
  societyId
) => {

  return GuestPass.exists({
    _id: id,
    societyId,
  });

};

// Find Latest Pass
exports.findLatest = (
  societyId
) => {

  return GuestPass.findOne({
    societyId,
  }).sort({
    createdAt: -1,
  });

};

// Find Oldest Pass
exports.findOldest = (
  societyId
) => {

  return GuestPass.findOne({
    societyId,
  }).sort({
    createdAt: 1,
  });

};

// =======================================================
// ADMIN / SYSTEM
// =======================================================

// =======================================================
// ARCHIVE PASS
// =======================================================

// =======================================================
// ARCHIVE PASS
// =======================================================

exports.archivePass = (
  id,
  societyId,
  previousStatus,
 archivedBy
) => {

  return GuestPass.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        status: "cancelled",
        statusReason: "Archived",
        isActive: false,
        cancelledAt: new Date(),
        cancelledBy: archivedBy,
      },

      $push: {
        statusHistory: {
          previousStatus,
          newStatus: "cancelled",
          changedBy: archivedBy,
          changedAt: new Date(),
          reason: "Archived",
        },
      },
    },
    {
      new: true,
    }
  );

};







