const User = require("../models/User");

const checkApproved = async (req, res, next) => {
  try {
    // console.log("CHECK APPROVED HIT"); // 👈 move to top

    const user = await User.findById(req.user.id);

    // // console.log("USER FROM DB:", user);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        message: "Access denied. Awaiting approval."
      });
    }

    next();

  } catch (error) {
    // console.error("CHECK APPROVED ERROR:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};

module.exports = checkApproved;