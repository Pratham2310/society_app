const jwt = require("jsonwebtoken");

const JWT_ISSUER = "society-app";
const JWT_AUDIENCE = "society-app-clients";

module.exports = (req, res, next) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authorization header missing"
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Invalid authorization format"
    });
  }

  const token = parts[1];

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    );

    req.user = {
      id: decoded.id,
      systemRole: decoded.systemRole,
      societyRole: decoded.societyRole,
      societyId: decoded.societyId,
      tokenVersion: decoded.tokenVersion,
    };

    // Never log the decoded payload — it carries identity claims
    // and, in a log drain, is as good as the token itself.
    return next();

  } catch (error) {

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });

  }

};

module.exports.JWT_ISSUER = JWT_ISSUER;
module.exports.JWT_AUDIENCE = JWT_AUDIENCE;
