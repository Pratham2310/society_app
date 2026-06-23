const mongoose = require("mongoose");

const repo = require(
  "../repository/helpRepository"
);


// ================= CREATE =================
exports.createHelpline = async (
  req
) => {

  return await repo.createHelpline({

    societyId: new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    title: req.body.title,

    category: req.body.category,

    phone: req.body.phone,

    alternatePhone:
      req.body.alternatePhone || "",

    description:
      req.body.description || "",

    availability:
      req.body.availability || "24/7",

    isPinned:
      req.body.isPinned || false
  });
};



// ================= GET =================
exports.getHelplines = async (
  req
) => {

  const filter = {};

  if (req.query.category) {
    filter.category =
      req.query.category;
  }

  return await repo.getHelplines(

    new mongoose.Types.ObjectId(
      req.user.societyId
    ),

    filter
  );
};



// ================= UPDATE =================
exports.updateHelpline = async (
  id,
  req
) => {

  const helpline =
    await repo.getHelplineById(id);

  if (!helpline) {
    throw new Error(
      "Helpline not found"
    );
  }

  return await repo.updateHelpline(
    id,
    req.body
  );
};



// ================= DELETE =================
exports.deleteHelpline = async (
  id
) => {

  const helpline =
    await repo.getHelplineById(id);

  if (!helpline) {
    throw new Error(
      "Helpline not found"
    );
  }

  return await repo.deleteHelpline(
    id
  );
};

