const dashboardService = require("../services/dashboardServices");

exports.getDashboard = async (req, res) => {
  try {
    const data = await dashboardService.getDashboard(req);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }
};