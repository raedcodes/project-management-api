import dotenv from "dotenv";
import { afterAll } from "vitest";
import { TEST_DATABASE } from "./global-setup.js";

// Runs in every test file BEFORE the file's own imports, so when the app loads
// src/config/database.js it already sees the test database.
// (Tests import app.js directly, not server.js, so they must load env themselves.)
dotenv.config({ quiet: true });
process.env.NODE_ENV = "test";
process.env.DATABASE_NAME = TEST_DATABASE;

// Close this file's connection pool so the test worker can exit cleanly
afterAll(async () => {
  const { prisma } = await import("../../src/config/database.js");
  await prisma.$disconnect();
});
