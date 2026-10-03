const jwt = require("jsonwebtoken");

// JWT payload contains the user's id and role. It is signed with JWT_SECRET from .env
const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });

module.exports = generateToken;
