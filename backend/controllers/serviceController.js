const serviceService = require("../services/serviceServices");

// create
exports.createService = async (req, res) => {
  const data = await serviceService.createService(req.body);

  res.json({ success: true, data });
};

// get all
exports.getAllServices = async (req, res) => {
  const data = await serviceService.getAllServices();

  res.json({ success: true, data });
};

// update
exports.updateService = async (req, res) => {
  const data = await serviceService.updateService(
    req.params.id,
    req.body
  );

  res.json({ success: true, data });
};

// assign
exports.assignService = async (req, res) => {
  const { societyIds } = req.body;

  const data = await serviceService.assignService(
    req.params.id,
    societyIds
  );

  res.json({ success: true, data });
};



//  UNASSIGN
exports.unassignService = async (req, res) => {
  try {
    const { societyId } = req.body;

    const data = await serviceService.unassignService(
      req.params.id,
      societyId
    );

    res.json({ success: true, data });

  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


//  LINKED SOCIETIES
exports.getLinkedSocieties = async (req, res) => {
  try {
    const data = await serviceService.getLinkedSocieties(req.params.id);

    res.json({ success: true, data });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};