import { z } from "zod";

// Trim and lowercase BEFORE the email check (z.email().trim() rejects " a@b.com ").
// Max 191 = the users.email column size.
const email = z.string().trim().toLowerCase().pipe(z.email().max(191));

const registerSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email,
  // bcrypt silently ignores everything after 72 bytes, so longer passwords are rejected.
  // Bytes, not characters: "é" is 2 bytes, most emoji are 4.
  password: z
    .string()
    .min(8)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
      error: "Password must be at most 72 bytes",
    }),
});

// No strength rules on login: accounts created under older rules must still be able to sign in
const loginSchema = z.strictObject({
  email,
  password: z.string().min(1),
});

// Our refresh tokens are 43 characters (32 random bytes in base64url); anything far off isn't one
const refreshTokenSchema = z.strictObject({
  refreshToken: z.string().min(1).max(100),
});

export { registerSchema, loginSchema, refreshTokenSchema };
