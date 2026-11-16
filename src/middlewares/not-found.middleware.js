import { AppError } from "../utils/app-error.js";

// Registered after all routes: anything reaching it matched no route.
// Uses req.path (not originalUrl) so query strings are never echoed back.
const notFound = (req, res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`));
};

export default notFound;
