// A custom error that carries an HTTP status code.
// Controllers do: throw new AppError("Resident not found", 404)
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
module.exports = AppError;
