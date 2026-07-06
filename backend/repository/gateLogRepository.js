const gateLog=require("../models/GateLog");
const GuestPass = require("../models/GuestPass");

//==============================
//CREATE
//==============================

exports.create=(data,session=null)=>{
  return gateLog.create([data],{session}).then((docs)=>docs[0]);
};


// =======================================================
// READ
// =======================================================


//find by id
exports.findById=(
  id,
  societyId
)=>{
  return gateLog.findOne({
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
  return gateLog.find({ societyId, guestPassId }).sort({ scanTime: -1 });
};

//find by resident

exports.findByResident=(societyId,residentId)=>{
  return gateLog.find({
    societyId,
    residentId
  })
};


//find by guard

exports.findByGuard=(societyId,guardId)=>{
  return gateLog.find({
    societyId,
    guardId,
  }).sort({scanTime:-1});
};


//find by flat
exports.findByFlat=(societyId,flatId)=>{
  return gateLog.find({
    societyId,
    flatId,
  }).sort({scanTime:-1});
};

//find by wing
exports.findByWing=(soietyId,wingId)=>{
  return gateLog.find({
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
  return gateLog.find({
    societyId,
  }).sort({scanTime:-1})
  .skip((page-1)*limit)
  .limit(limit);
};


//find latest scan
exports.findLatestScan=(societyId,guestPassId)=>{
  return gateLog.findOne({
    societyId,
    guestPassId,
  }).sort({scanTIme:-1});
};


//find latest entry
exports.findLatestEntry=(societyId,guestPassId)=>{
  return gateLog.findOne({
    societyId,
    guestPassId,
    scanType:"entry",
  }).sort({scanTime:-1});
};


//find latest exit
exports.findLatestExit=(societyId,guestPassId)=>{
  return gateLog.findOne({
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
  return gateLog.find({
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
  return gateLog.exists({
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
  return gateLog.find({
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
  return gateLog.find({
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
  return gateLog.find({
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

  return gateLog.find({
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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.find({

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

  return gateLog.findOneAndUpdate(
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

  return gateLog.findOneAndUpdate(
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

  return gateLog.findOneAndUpdate(
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

  return gateLog.findOneAndUpdate(
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
  return gateLog.countDocuments(societyId,);
};


//count by visitor type
exports.countByVisitor=(societyId,visitorType)=>{
  return gateLog.countDocuments({
    societyId,
    visitorType,
  });
};

//coumt by scan type

exports.countByScanType=(societyId,scanType)=>{
  return gateLog.countDocuments({
      societyId,
      scanType
  });
};


//count by status

exports.countByStatus=(societyId,status)=>{
  return gateLog.countDocuments({
    societyId,
    status
  });
};


//count by verification method

exports.countByVerifcationMethod=(societyId,verificationMethod)=>{
  return gateLog.countDocuments({
    societyId,
    verificationMethod,
  });
};


//count todays entry

exports.countTodaysEntry=(societyId,startOfDay,endOdDay)=>{
  return gateLog.countDocuments({
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
  return gateLof.countDocuments({
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
  return gateLog.countDocuments({
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