const complaintService = require("../services/complaintService");
const {
  createComplaintSchema,
  updateStatusSchema
} = require("../validation/complaintValidation");
exports.createComplaint = async (req, res) => {
  try {
    const { error } = createComplaintSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const data = await complaintService.createComplaint(req);
    res.json({ success: true, data });

  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const data = await complaintService.getComplaints(req);
    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getComplaintById = async (req, res) => {
  try {
    const data = await complaintService.getComplaintById(req.params.id, req);
    res.json({ success: true, data });

  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { error } = updateStatusSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const data = await complaintService.updateStatus(
      req.params.id,
      req.body.status,
      req
    );

    res.json({ success: true, data });

  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};