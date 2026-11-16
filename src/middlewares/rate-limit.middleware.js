import rateLimit from "express-rate-limit";
import { AppError } from "../utils/app-error.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
  skipSuccessfulRequests: true, // Only count failed requests (4xx and 5xx) toward the rate limit
  handler: (req, res, next) => {
    next(new AppError(429, "TOO_MANY_REQUESTS", "Too many login attempts, please try again later"))
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // Limit each IP to 10 requests per `window` (here, per 1 hour).
  standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
  skipSuccessfulRequests: false, // Count all requests toward the rate limit, regardless of success or failure
  handler: (req, res, next) => {
    next(new AppError(429, "TOO_MANY_REQUESTS", "Too many registration attempts, please try again later"))
  }
});

export {loginLimiter, registerLimiter};
