const GuestPass = require("../models/GuestPass");

// =======================================================
// PRIVATE
// BUILD QUERY OPTIONS
// =======================================================

const buildQueryOptions = (options = {}) => {

  return {

    page: Number(options.page) || 1,

    limit: Number(options.limit) || 10,

    sort: options.sort || {
      createdAt: -1,
    },

    select: options.select || "",

  };

};


// =======================================================
// PRIVATE
// APPLY PAGINATION
// =======================================================

const applyPagination = (
  query,
  options = {}
) => {

  const {

    page,

    limit,

    sort,

    select,

  } = buildQueryOptions(options);

  return query

    .select(select)

    .sort(sort)

    .skip((page - 1) * limit)

    .limit(limit);

};


// =======================================================
// PRIVATE
// APPLY UPDATE OPTIONS
// =======================================================

const applyUpdateOptions = (
  session = null
) => {

  return {

    new: true,

    runValidators: true,

    session,

  };

};


// =======================================================
// PRIVATE
// BUILD FILTER
// =======================================================

const buildGuestPassFilter = (
  guestPassId,
  societyId
) => ({

  _id: guestPassId,

  societyId,

});


// =======================================================
// CREATE
// =======================================================

exports.create = async (
  data,
  session = null
) => {

  if (session) {

    const [guestPass] = await GuestPass.create(
      [data],
      { session }
    );

    return guestPass;

  }

  return GuestPass.create(data);

};

// =======================================================
// READ
// =======================================================

// =======================================================
// Find Guest Pass By Id
// =======================================================

exports.findGuestPassById = (
  guestPassId,
  societyId
) => {

  return GuestPass.findOne({

    _id: guestPassId,

    societyId,

  })

    .populate(
      "residentId",
      "name phone profilePicture"
    )

    .populate(
      "flatId",
      "flatNumber"
    )

    .populate(
      "wingId",
      "name"
    )

    .populate(
      "societyId",
      "name"
    );

};

// =======================================================
// Find Pass By QR Token
// =======================================================

exports.findPassByToken = (
  qrToken,
  societyId
) => {

  return GuestPass.findOne({

    qrToken,

    societyId,

  });

};

// =======================================================
// Find Active Pass By QR Token
// =======================================================

exports.findActivePassByToken = (
  qrToken,
  societyId
) => {

  return GuestPass.findOne({

    qrToken,

    societyId,

    status: "active",

  });

};

// =======================================================
// Find Resident Passes
// =======================================================

exports.findResidentPasses = (
  residentId,
  societyId,
  options = {}
) => {

  const {

    page,

    limit,

    sort,

    select,

  } = buildQueryOptions(options);

  return GuestPass.find({

    residentId,

    societyId,

  })

    .select(select)

    .sort(sort)

    .skip((page - 1) * limit)

    .limit(limit)

    .lean();

};

// =======================================================
// Find Society Passes
// =======================================================

exports.findSocietyPasses = (
  societyId,
  options = {}
) => {

  const {

    page,

    limit,

    sort,

    select,

  } = buildQueryOptions(options);

  return GuestPass.find({

    societyId,

  })

    .select(select)

    .sort(sort)

    .skip((page - 1) * limit)

    .limit(limit)

    .lean();

};

// =======================================================
// Find Guest Passes
// =======================================================

exports.findGuestPasses = (
  filter = {},
  options = {}
) => {

  const {

    page,

    limit,

    sort,

    select,

  } = buildQueryOptions(options);

  return GuestPass.find(filter)

    .select(select)

    .sort(sort)

    .skip((page - 1) * limit)

    .limit(limit)

    .lean();

};


// =======================================================
// SEARCH
// =======================================================

// =======================================================
// Search Guest Passes
// =======================================================

exports.searchGuestPasses = (
  societyId,
  keyword,
  options = {}
) => {

  const query = GuestPass.find({

    societyId,

    $or: [

      {
        guestName: {
          $regex: keyword,
          $options: "i",
        },
      },

      {
        guestPhone: {
          $regex: keyword,
          $options: "i",
        },
      },

      {
        vehicleNumber: {
          $regex: keyword,
          $options: "i",
        },
      },

    ],

  });

  return applyPagination(
    query,
    options
  ).lean();

};



// =======================================================
// FILTERS
// =======================================================

// =======================================================
// Find Passes By Status
// =======================================================

exports.findPassesByStatus = (
  societyId,
  status,
  options = {}
) => {

  const query = GuestPass.find({

    societyId,

    status,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Find Passes By Type
// =======================================================

exports.findPassesByType = (
  societyId,
  passType,
  options = {}
) => {

  const query = GuestPass.find({

    societyId,

    passType,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Find Passes By Purpose
// =======================================================

exports.findPassesByPurpose = (
  societyId,
  purpose,
  options = {}
) => {

  const query = GuestPass.find({

    societyId,

    purpose,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Find Passes Between Dates
// =======================================================

exports.findPassesBetweenDates = (

  societyId,

  startDate,

  endDate,

  options = {}

) => {

  const query = GuestPass.find({

    societyId,

    createdAt: {

      $gte: startDate,

      $lte: endDate,

    },

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Find Expiring Soon
// =======================================================

exports.findExpiringSoon = (

  societyId,

  date,

  options = {}

) => {

  const query = GuestPass.find({

    societyId,

    status: "active",

    expiryDate: {

      $lte: date,

    },

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Find Recent Passes
// =======================================================

exports.findRecentPasses = (
  societyId,
  limit = 10
) => {

  return GuestPass.find({

    societyId,

  })

    .sort({

      createdAt: -1,

    })

    .limit(limit)

    .lean();

};




// =======================================================
// REPORTS
// =======================================================

// =======================================================
// Resident History
// =======================================================

exports.findResidentHistory = (

  societyId,

  residentId,

  options = {}

) => {

  const query = GuestPass.find({

    societyId,

    residentId,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Flat History
// =======================================================

exports.findFlatHistory = (

  societyId,

  flatId,

  options = {}

) => {

  const query = GuestPass.find({

    societyId,

    flatId,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Wing History
// =======================================================

exports.findWingHistory = (

  societyId,

  wingId,

  options = {}

) => {

  const query = GuestPass.find({

    societyId,

    wingId,

  });

  return applyPagination(
    query,
    options
  ).lean();

};

// =======================================================
// Today's Passes
// =======================================================

exports.findTodaysPasses = (

  societyId,

  startOfDay,

  endOfDay

) => {

  return GuestPass.find({

    societyId,

    createdAt: {

      $gte: startOfDay,

      $lte: endOfDay,

    },

  })

    .sort({

      createdAt: -1,

    })

    .lean();

};

// =======================================================
// Permanent Passes
// =======================================================

exports.findPermanentPasses = (
  societyId,
  options = {}
) => {

  return exports.findPassesByType(
    societyId,
    "permanent",
    options
  );

};

// =======================================================
// Multi Day Passes
// =======================================================

exports.findMultiDayPasses = (
  societyId,
  options = {}
) => {

  return exports.findPassesByType(
    societyId,
    "multi_day",
    options
  );

};

// =======================================================
// One Time Passes
// =======================================================

exports.findOneTimePasses = (
  societyId,
  options = {}
) => {

  return exports.findPassesByType(
    societyId,
    "one_time",
    options
  );

};


// =======================================================
// SAVE INITIAL QR CODE
// =======================================================

exports.saveInitialQRCode = (

  guestPassId,

  societyId,

  qrCode,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

      societyId,

    },

    {

      $set: {

        qrCode,

        lastQrGeneratedAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};



// =======================================================
// REGENERATE QR CODE
// =======================================================

exports.regenerateQRCode = (

  guestPassId,

  societyId,

  qrToken,

  qrCode,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

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

    applyUpdateOptions(session)

  );

};



// =======================================================
// UPDATE PASS STATUS
// =======================================================

exports.updatePassStatus = (

  guestPassId,

  societyId,

  previousStatus,

  newStatus,

  reason,

  changedBy,

  session = null

) => {

  const updateData = {

    status: newStatus,

    statusReason: reason,

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

      _id: guestPassId,

      societyId,

    },

    {

      $set: updateData,

      $push: {

        statusHistory: {

          previousStatus,

          newStatus,

          changedBy,

          changedAt: new Date(),

          reason,

        },

      },

    },

    applyUpdateOptions(session)

  );

};



// =======================================================
// APPROVE PASS
// =======================================================

exports.approvePass = (

  guestPassId,

  societyId,

  approvedBy,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

      societyId,

    },

    {

      $set: {

        approvedBy,

        approvedAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};


// =======================================================
// EXTEND PASS
// =======================================================

exports.extendPass = (

  guestPassId,

  societyId,

  expiryDate,

  history,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

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

    applyUpdateOptions(session)

  );

};




// =======================================================
// UPDATE NOTIFICATION TIME
// =======================================================

exports.updateNotificationTime = (

  guestPassId,

  societyId,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

      societyId,

    },

    {

      $set: {

        lastNotificationSentAt: new Date(),

      },

    },

    applyUpdateOptions(session)

  );

};



// =======================================================
// UPDATE METADATA
// =======================================================

exports.updateMetadata = (

  guestPassId,

  societyId,

  metadata,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    {

      _id: guestPassId,

      societyId,

    },

    {

      $set: {

        metadata,

      },

    },

    applyUpdateOptions(session)

  );

};

// =======================================================
// ANALYTICS
// =======================================================

// Count By Status

exports.countPassesByStatus = (

  societyId,

  status

) => {

  return GuestPass.countDocuments({

    societyId,

    status,

  });

};

// Count By Pass Type

exports.countPassesByType = (

  societyId,

  passType

) => {

  return GuestPass.countDocuments({

    societyId,

    passType,

  });

};

// Count Resident Passes

exports.countResidentPasses = (

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

exports.countTotalPasses = (

  societyId

) => {

  return GuestPass.countDocuments({

    societyId,

  });

};


// =======================================================
// UTILITIES
// =======================================================

// Guest Pass Exists

exports.guestPassExists = (

  guestPassId,

  societyId

) => {

  return GuestPass.exists(

    buildGuestPassFilter(

      guestPassId,

      societyId

    )

  );

};

// Exists By QR Token

exports.existsByToken = (

  qrToken,

  societyId

) => {

  return GuestPass.exists({

    qrToken,

    societyId,

  });

};

// Latest Guest Pass

exports.findLatestGuestPass = (

  societyId

) => {

  return GuestPass.findOne({

    societyId,

  })

    .sort({

      createdAt: -1,

    });

};

// Oldest Guest Pass

exports.findOldestGuestPass = (

  societyId

) => {

  return GuestPass.findOne({

    societyId,

  })

    .sort({

      createdAt: 1,

    });

};



// =======================================================
// ADMIN
// =======================================================

// Archive Guest Pass

exports.archiveGuestPass = (

  guestPassId,

  societyId,

  previousStatus,

  archivedBy,

  session = null

) => {

  return GuestPass.findOneAndUpdate(

    buildGuestPassFilter(

      guestPassId,

      societyId

    ),

    {

      $set: {

        status: "cancelled",

        statusReason: "Archived",

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

    applyUpdateOptions(session)

  );

};