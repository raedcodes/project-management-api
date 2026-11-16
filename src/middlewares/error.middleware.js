import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

// Express recognises error middleware by its 4 parameters, so `next` must stay even though
// it's only used for the headersSent case. Must be registered last in app.js.
const errorHandler = (err, req, res, next) => {
  // The response already started: we can't send JSON now, so let Express close the connection
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  // Errors from express.json()
  if (err.type === "entity.parse.failed") {
    return sendError(res, 400, "INVALID_JSON", "Request body is not valid JSON");
  }
  if (err.type === "entity.too.large") {
    return sendError(res, 413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  // Prisma safety net: services already handle the expected cases
  if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      return sendError(res, 409, "CONFLICT", "A record with this value already exists");
    }
    if (err.code === "P2025") {
      return sendError(res, 404, "NOT_FOUND", "Resource not found");
    }
  }

  // Other 4xx errors raised by Express internals (e.g. unsupported charset) are safe to show
  if (err.expose && err.status >= 400 && err.status < 500) {
    return sendError(res, err.status, "INVALID_REQUEST", err.message);
  }

  // Unexpected: full details go to the server log only, never to the client.
  // Never log req.body here: it can contain passwords and tokens.
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return sendError(res, 500, "INTERNAL_ERROR", "Something went wrong");
};

export default errorHandler;
