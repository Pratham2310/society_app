const societyService = require("../services/societyService");

// CREATE SOCIETY
exports.createSociety = async (req, res, next) => {
  const result = await societyService.createSociety(req.body);

  res.status(201).json({
    message: "Society created successfully",
    data: {
      society: result.society,
      secretary: result.secretary
    }
  });
};

// VERIFY SOCIETY CODE
exports.verifySocietyCode = async (req, res, next) => {
  const { societyCode } = req.body;

  const society = await societyService.verifySocietyCode(societyCode);

  //city is included so the join screen can confirm the right society
  //back to the resident ("Found: Emerald Heights, Nashik") rather than
  //making them trust a name alone.
  res.json({
    data: {
      societyId: society._id,
      name: society.name,
      city: society.city || null
    }
  });
};

// GET REGISTRATION STRUCTURE
// Public: the resident has no account yet at this point in the flow.
exports.getRegistrationStructure = async (req, res) => {

  const structure = await societyService.getRegistrationStructure(
    req.params.societyId
  );

  res.json({
    message: "Society structure fetched successfully",
    data: structure
  });

};


// UPDATE SOCIETY
exports.updateSociety = async (req, res, next) => {
  try {
    const society = await societyService.updateSociety(req.params.societyId, req.body);
    res.json({ message: "Society updated", data: society });
  } catch (err) {
    next(err);
  }
};

// DELETE SOCIETY
exports.deleteSociety = async (req, res, next) => {
  try {
    const result = await societyService.deleteSociety(
      req.params.societyId,
      req.body.confirmName
    );
    res.json({ message: "Society deleted", data: result });
  } catch (err) {
    next(err);
  }
};

// ASSIGN SECRETARY
exports.assignSecretary = async (req, res, next) => {
  try {
    const result = await societyService.assignSecretary(req.params.societyId, req.body);
    res.json({ message: "Secretary assigned", data: result });
  } catch (err) {
    next(err);
  }
};

// LIST MEMBERS
exports.listMembers = async (req, res, next) => {
  try {
    const members = await societyService.listMembers(req.params.societyId);
    res.json({ message: "Members fetched successfully", data: members });
  } catch (err) {
    next(err);
  }
};
