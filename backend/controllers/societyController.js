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
