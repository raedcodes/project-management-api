// An expected HTTP error whose message is safe to show the client
// (Laravel equivalent: abort() / HttpException).
export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code; // machine-readable, e.g. "NOT_FOUND"
    this.details = details;
  }
}
