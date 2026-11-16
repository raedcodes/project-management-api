import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { jwtConfig } from "../config/jwt.js";
import { AppError } from "../utils/app-error.js";

const BCRYPT_COST = 12; // ≈170 ms per hash on the dev machine

// Used when the email doesn't exist, so "unknown email" takes as long as "wrong password"
// and response time can't reveal which emails are registered. Computed once at startup.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", BCRYPT_COST);

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

// Only the user id goes in the token: the payload is readable by anyone who has it
const signToken = (userId) =>
  jwt.sign({ sub: userId }, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    expiresIn: jwtConfig.expiresIn,
  });

const register = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    // The global omit in database.js keeps the hash out of the returned user
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash },
    });
    return { user, token: signToken(user.id) };
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
    }
    throw error;
  }
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    omit: { password: false }, // the one place the hash is read
  });

  // Always run bcrypt, even for an unknown email (see DUMMY_HASH)
  const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !passwordMatches) {
    throw invalidCredentials();
  }

  const { password: _hash, ...safeUser } = user;
  return { user: safeUser, token: signToken(user.id) };
};

export { register, login };
