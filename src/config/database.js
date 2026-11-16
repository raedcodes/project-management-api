import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.ts";

// Reads env at import time, so "dotenv/config" must be loaded first (see server.js).
const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  // MySQL 8.4 (caching_sha2_password) without TLS needs the server's RSA key on a cold auth cache.
  // OK for the local Docker DB; production should connect over TLS instead.
  allowPublicKeyRetrieval: true,
});

// One shared client: Node caches modules, so every import gets this same instance.
export const prisma = new PrismaClient({
  adapter,
  // Password hashes are never read unless a query opts in with `omit: { password: false }` (login only)
  omit: { user: { password: true } },
});
