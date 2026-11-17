import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.js";
import { AppError } from "../utils/app-error.js";
import { prisma } from "../config/database.js";

const invalidToken = () => new AppError(401, "INVALID_TOKEN", "Token is invalid");

// Requires "Authorization: Bearer <jwt>" and sets req.user = { id }.
// Throwing here is fine: Express sends errors from middleware to the error handler.
const authenticate = async (req, res, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = jwt.verify(match[1], jwtConfig.secret, { algorithms: [jwtConfig.algorithm] });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError(401, "TOKEN_EXPIRED", "Token has expired");
    }
    throw invalidToken();
  }

  // Without a real id, `where: { userId: undefined }` would match every user's tasks
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw invalidToken();
  }

  //check if the user exists in the database (optional, but recommended)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true },
  });

  if (!user) {
    throw invalidToken();
  }

  req.user = { id: user.id };
  next();
};

export default authenticate;
