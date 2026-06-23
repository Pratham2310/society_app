const Helpline = require(
  "../models/Helpline"
);


// ================= CREATE =================
exports.createHelpline = (data) =>
  Helpline.create(data);


// ================= GET ALL =================
exports.getHelplines = (
  societyId,
  filter
) => {

  return Helpline.find({

    societyId,

    isActive: true,

    ...filter

  })

    .sort({
      isPinned: -1,
      createdAt: -1
    })

    .lean();
};


// ================= GET SINGLE =================
exports.getHelplineById = (id) =>
  Helpline.findById(id);


// ================= UPDATE =================
exports.updateHelpline = (
  id,
  data
) => {

  return Helpline.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );
};


// ================= DELETE =================
exports.deleteHelpline = (id) => {

  return Helpline.findByIdAndUpdate(
    id,
    {
      isActive: false
    },
    { new: true }
  );
};