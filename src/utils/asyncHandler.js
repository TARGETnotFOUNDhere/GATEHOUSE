// Wraps an async controller so any error is passed to the central error handler (no try/catch everywhere).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = asyncHandler;
