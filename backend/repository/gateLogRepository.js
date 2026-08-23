const GateLog=require("../models/GateLog");
const GuestPass = require("../models/GuestPass");

//==============================
//CREATE
//==============================

exports.create=(data,session=null)=>{
  return GateLog.create([data],{session}).then((docs)=>docs[0]);
};


// =======================================================
// READ
// =======================================================


//find by id
exports.findById=(
  id,
  societyId
)=>{
  return GateLog.findOne({
    _id:id,
    societyId,
  }).populate("guestPassId")
  .populate("residentId",
    "name phone profilePicture"
  )
  .populate(
      "guardId",
      "name email"
    )
    .populate(
      "flatId",
      "flatNumber"
    )
    .populate(
      "wingId",
      "name"
    );

};


//find by guest pass

exports.findByGuestPass=(societyId,guestPassId)=>{
  return GateLog.find({ societyId, guestPassId }).sort({ scanTime: -1 });
};

//find by resident

exports.findByResident=(societyId,residentId)=>{
  return GateLog.find({
    societyId,
    residentId
  })
};


//find by guard

exports.findByGuard=(societyId,guardId)=>{
  return GateLog.find({
    societyId,
    guardId,
  }).sort({scanTime:-1});
};


//find by flat
exports.findByFlat=(societyId,flatId)=>{
  return GateLog.find({
    societyId,
    flatId,
  }).sort({scanTime:-1});
};

//find by wing
exports.findByWing=(societyId,wingId)=>{
  return GateLog.find({
    societyId,
    wingId,
  }).sort({scanTime:-1});
};


//find by society
exports.findBySociety=(societyId,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;
  return GateLog.find({
    societyId,
  }).sort({scanTime:-1})
  .skip((page-1)*limit)
  .limit(limit);
};


//find latest scan
exports.findLatestScan=(societyId,guestPassId)=>{
  return GateLog.findOne({
    societyId,
    guestPassId,
  }).sort({scanTIme:-1});
};


//find latest entry
exports.findLatestEntry=(societyId,guestPassId)=>{
  return GateLog.findOne({
    societyId,
    guestPassId,
    scanType:"entry",
  }).sort({scanTime:-1});
};


//find latest exit
exports.findLatestExit=(societyId,guestPassId)=>{
  return GateLog.findOne({
    societyId,
    guestPassId,
    scanType:"exit"
  }).sort({scanTime:-1});
};


//====================================================
// SEARCH
//====================================================

//search visitor
exports.searchVisitor=(societyId,keyword)=>{
  return GateLog.find({
    societyId,
    $or:[
      {visitorName:{
        $regex:keyword,
        $options:"i"
      },
    },
      {visitorPhone:{
        $regex:keyword,
        $options:"i"
      },},
     {
      vehicleNumber:{
        $regex:keyword,
        $options:"i"
      },},

    ],
  }).sort({scanTime:-1});
};



//==========================================
//EXISTS
//========================================


exports.existsById=(societyId,id)=>{
  return GateLog.exists({
    _id:id,
    societyId,
  });
};


//=========================================
//FILTERS
//=========================================

//find by scan type
exports.findByScanType=(societyId,scanType,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;
  return GateLog.find({
    societyId,
    scanType,
  }).sort({scanTime:-1})
  .skip((page-1)*limit)
  .limit(limit);
};


//================================================
//find by visitor type
//================================================

exports.findByVisitorType=(societyId,visitorId,options={})=>{
  const {
    page=1,
    limit=10,
  }=options;
  return GateLog.find({
    societyId,
    visitorId,
})
.sort({
  scaTime:-1
}).skip((page-1)*limit)
.limit(limit);
};


//================================================
//find by status
//================================================

exports.findByStatus=(
  societyId,
  status,
  options={}
)=>{
  const {
    page=1,
    limit=10,
  }=options;
  return GateLog.find({
    societyId,
    status,
  }).sort({scanTime:-1})
  .skip((page-1)*limit)
  .limit(limit);
};



// =======================================================
// Find By Verification Method
// =======================================================

exports.findByVerificationMethod = (
  societyId,
  verificationMethod,
  options = {}
) => {

  const {
    page = 1,
    limit = 20,
  } = options;

  return GateLog.find({
    societyId,
    verificationMethod,
  })
    .sort({
      scanTime: -1,
    })
    .skip((page - 1) * limit)
    .limit(limit);

};

// =======================================================
// Find Between Dates
// =======================================================

exports.findBetweenDates = (
  societyId,
  startDate,
  endDate
) => {

  return GateLog.find({

    societyId,

    scanTime: {

      $gte: startDate,

      $lte: endDate,

    },

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// REPORTS
// =======================================================

// Today's Logs
exports.findTodayLogs = (
  societyId,
  startOfDay,
  endOfDay
) => {

  return GateLog.find({

    societyId,

    scanTime: {

      $gte: startOfDay,

      $lte: endOfDay,

    },

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Current Visitors
// =======================================================

exports.findCurrentVisitors = (
  societyId
) => {

  return GateLog.find({

    societyId,

    scanType: "entry",

    status: "completed",

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Resident History
// =======================================================

exports.findResidentHistory = (
  societyId,
  residentId
) => {

  return GateLog.find({

    societyId,

    residentId,

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Guard History
// =======================================================

exports.findGuardHistory = (
  societyId,
  guardId
) => {

  return GateLog.find({

    societyId,

    guardId,

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Flat History
// =======================================================

exports.findFlatHistory = (
  societyId,
  flatId
) => {

  return GateLog.find({

    societyId,

    flatId,

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Wing History
// =======================================================

exports.findWingHistory = (
  societyId,
  wingId
) => {

  return GateLog.find({

    societyId,

    wingId,

  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Guest Pass History
// =======================================================

exports.findGuestPassHistory = (
  societyId,
  guestPassId
) => {

  return GateLog.find({

    societyId,

    guestPassId,

  }).sort({
    scanTime: -1,
  });

};



// =======================================================
// UPDATE REMARKS
// =======================================================

exports.updateRemarks = (
  id,
  societyId,
  remarks
) => {

  return GateLog.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        remarks,
      },
    },
    {
      new: true,
    }
  );

};

// =======================================================
// UPDATE GUARD NOTES
// =======================================================

exports.updateGuardNotes = (
  id,
  societyId,
  guardNotes
) => {

  return GateLog.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        guardNotes,
      },
    },
    {
      new: true,
    }
  );

};


// =======================================================
// ADD GUARD NOTE
// =======================================================

exports.addGuardNote = (
  id,
  societyId,
  note,
  addedBy
) => {

  return GateLog.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $push: {
        guardNotes: {
          note,
          addedBy,
          addedAt: new Date(),
        },
      },
    },
    {
      new: true,
    }
  );

};
// =======================================================
// UPDATE REJECTION REASON
// =======================================================

exports.updateRejectionReason = (
  id,
  societyId,
  rejectionReason
) => {

  return GateLog.findOneAndUpdate(
    {
      _id: id,
      societyId,
    },
    {
      $set: {
        rejectionReason,
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

  return GateLog.findOneAndUpdate(
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


//========================================
//ANALYTICS
//========================================

//count total logs
exports.countTotla=(societyId)=>{
  return GateLog.countDocuments(societyId,);
};


//count by visitor type
exports.countByVisitor=(societyId,visitorType)=>{
  return GateLog.countDocuments({
    societyId,
    visitorType,
  });
};

//coumt by scan type

exports.countByScanType=(societyId,scanType)=>{
  return GateLog.countDocuments({
      societyId,
      scanType
  });
};


//count by status

exports.countByStatus=(societyId,status)=>{
  return GateLog.countDocuments({
    societyId,
    status
  });
};


//count by verification method

exports.countByVerifcationMethod=(societyId,verificationMethod)=>{
  return GateLog.countDocuments({
    societyId,
    verificationMethod,
  });
};


//count todays entry

exports.countTodaysEntry=(societyId,startOfDay,endOfDay)=>{
  return GateLog.countDocuments({
    societyId,
    scanType:"entry",
    scanTime:{
      $gte:startOfDay,
      $lte:endOfDay,
    }
  });
};


//count todays exits

exports.countTodaysExits=(societyId,startOfDay,endOfDay)=>{
  return GateLog.countDocuments({
    societyId,
    scanType:"exit",
    scanTime:{
      $gte:startOfDay,
      $lte:endOfDay,
    }
  });
};


//count rejected

exports.countRejected=(societyId,startOfDay,endOfDay)=>{
  return GateLog.countDocuments({
    societyId,
    status:"rejected",
    scanTime:{
      $gte:startOfDay,
      $lte:endOfDay,
    }
  });
};


// =======================================================
// Find Latest Log
// =======================================================

exports.findLatest = (
  societyId
) => {

  return GateLog.findOne({
    societyId,
  }).sort({
    scanTime: -1,
  });

};

// =======================================================
// Find Oldest Log
// =======================================================

exports.findOldest = (
  societyId
) => {

  return GateLog.findOne({
    societyId,
  }).sort({
    scanTime: 1,
  });

};

// =======================================================
// Find Logs By Date
// =======================================================

exports.findLogsBetweenDates = (
  societyId,
  date
) => {

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return GateLog.find({

    societyId,

    scanTime: {
      $gte: start,
      $lte: end,
    },

  }).sort({
    scanTime: -1,
  });

};