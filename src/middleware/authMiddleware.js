const jwt = require("jsonwebtoken");
const Resident = require("../models/Resident");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

// AUTHENTICATION: "Who are you?"
// Reads the token from the header  Authorization: Bearer <token>, verifies it, and attaches the user to req.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Not authenticated. Please log in and send a Bearer token", 401);
  }
  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws if invalid/expired

  // make sure the user still exists in the database
  const user = await Resident.findById(decoded.id);
  if (!user) throw new AppError("User belonging to this token no longer exists", 401);

  req.user = { id: user._id.toString(), role: user.role };
  next();
});

module.exports = authenticate;
