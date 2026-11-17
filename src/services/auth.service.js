import bcrypt from "bcrypt";
import crypto from "node:crypto";
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

// SHA-256, not bcrypt: the token is 256 random bits, so it can't be guessed, and a fast,
// deterministic hash lets us find it with WHERE tokenHash = ? (bcrypt salts make that impossible).
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const invalidRefreshToken = () =>
  new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");

// Stores only the hash; the raw token is returned once and never kept on the server
const createRefreshToken = async (userId) => {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + jwtConfig.refreshTokenDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  return token;
};

const issueTokens = async (userId) => ({
  token: signToken(userId),
  refreshToken: await createRefreshToken(userId),
});

const register = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let user;
  try {
    // The global omit in database.js keeps the hash out of the returned user
    user = await prisma.user.create({
      data: { name, email, password: passwordHash },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(409, "EMAIL_TAKEN", "Email is already registered");
    }
    throw error;
  }

  // Outside the try: the P2002 catch above is only about the email
  return { user, ...(await issueTokens(user.id)) };
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
  return { user: safeUser, ...(await issueTokens(user.id)) };
};

// Rotation: each refresh token works once. Using it revokes it and returns a new pair.
const refresh = async (refreshToken) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });
  if (!stored) {
    throw invalidRefreshToken();
  }

  // An already-used token came back: a client bug or a stolen copy. We can't tell which,
  // so revoke every session of this user (the real user just logs in again).
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw invalidRefreshToken();
  }

  if (stored.expiresAt <= new Date()) {
    throw invalidRefreshToken();
  }

  // "revokedAt: null" in the WHERE makes this race-safe: if two requests send the same token
  // at once, only one update matches; the other gets a 401 instead of a second token pair.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) {
    throw invalidRefreshToken();
  }

  // Revoke first, then issue: if issuing fails, the user logs in again. Never two valid tokens.
  return issueTokens(stored.userId);
};

// Deletes the refresh token. Always succeeds: safe to retry, and doesn't reveal if it existed.
const logout = async (refreshToken) => {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
};

export { register, login, refresh, logout };
