const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authorization header missing"
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      message: "Invalid authorization format"
    });
  }

  const token = parts[1];

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ✅ FIXED HERE
    req.user = {
      id: decoded.id,
      systemRole: decoded.systemRole,
      societyRole: decoded.societyRole,
      societyId: decoded.societyId
    };

    next();
    console.log("DECODED:", decoded);
    console.log("REQ.USER:", req.user);
  } catch (error) {

    return res.status(401).json({
      message: "Invalid or expired token"
    });

  }

};