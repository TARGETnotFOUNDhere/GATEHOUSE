// Handles requests to routes that don't exist (404)
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

// CENTRALIZED ERROR HANDLER: Express recognises it by its 4 parameters.
// Every error in the app ends up here and is sent as consistent JSON.
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Server error";

  if (err.name === "ValidationError") {
    statusCode = 400; // Mongoose schema validation failed
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  } else if (err.name === "CastError") {
    statusCode = 400; // e.g. invalid ObjectId
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    statusCode = 409; // duplicate key (unique index)
    message = "Duplicate value: this record already exists";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please log in again";
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON in request body";
  }

  if (statusCode === 500) console.error(err);
  res.status(statusCode).json({ success: false, message });
};

module.exports = { notFound, errorHandler };
