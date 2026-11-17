// JWT settings, checked once when the module is imported (env is loaded first by server.js).
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be set and at least 32 characters (generate: openssl rand -hex 32)");
}

const jwtConfig = {
  secret,
  // Short-lived: a leaked access token is only useful for minutes. Refresh tokens renew it.
  expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  // Pinned: verify() only accepts this algorithm, so a token can't pick its own (e.g. "none")
  algorithm: "HS256",
};

export { jwtConfig };
