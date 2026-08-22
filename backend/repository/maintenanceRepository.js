const Bill = require("../models/MaintenanceBill");

// create bill
exports.create = (data) => Bill.create(data);

// bulk create (IMPORTANT)
//ordered:false so one already-existing bill does not abort the whole
//batch. Duplicate-key errors are reported back rather than thrown.
exports.createMany = async (data) => {

  try {

    return await Bill.insertMany(data, { ordered: false });

  } catch (error) {

    //Every write error here is a duplicate (code 11000) when the batch
    //re-runs for a month already generated. Anything else is real.
    const onlyDuplicates =
      error.writeErrors &&
      error.writeErrors.every((e) => e.err?.code === 11000 || e.code === 11000);

    if (onlyDuplicates) {
      return error.insertedDocs || [];
    }

    throw error;

  }

};

// get all bills
exports.findAll = (filter) =>
  Bill.find(filter).sort({ createdAt: -1 }).lean();

// get one
exports.findById = (id) => Bill.findById(id);

// update
exports.update = (id, data, session = null) =>
  Bill.findByIdAndUpdate(id, data, {
    new: true,
    ...(session ? { session } : {}),
  });