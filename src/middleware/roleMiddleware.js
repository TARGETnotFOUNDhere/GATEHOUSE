const AppError = require("../utils/AppError");

// AUTHORIZATION: "Are you allowed to do this?"
// Reusable: authorize("guard") or authorize("resident", "guard")
// It returns a middleware function (a closure that remembers allowedRoles).
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return next(new AppError(`Access denied. Only ${allowedRoles.join("/")} can do this`, 403));
  }
  next();
};

module.exports = authorize;
