const helpService = require("../services/helpServices");

const {
  createHelplineSchema
} = require(
  "../validation/helpValidation"
);


// ================= CREATE =================
exports.createHelpline = async (
  req,
  res
) => {

  try {

    const { error } =
      createHelplineSchema.validate(
        req.body
      );

    if (error) {
      return res.status(400).json({
        success: false,
        message:
          error.details[0].message
      });
    }

    const data =
      await helpService.createHelpline(
        req
      );

    res.status(201).json({
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



// ================= GET =================
exports.getHelplines = async (
  req,
  res
) => {

  try {

    const data =
      await helpService.getHelplines(
        req
      );

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



// ================= UPDATE =================
exports.updateHelpline = async (
  req,
  res
) => {

  try {

    const data =
      await helpService.updateHelpline(
        req.params.id,
        req
      );

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



// ================= DELETE =================
exports.deleteHelpline = async (
  req,
  res
) => {

  try {

    const data =
      await helpService.deleteHelpline(
        req.params.id
      );

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