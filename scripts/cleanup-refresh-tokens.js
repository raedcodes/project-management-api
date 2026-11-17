import "dotenv/config";
import { prisma } from "../src/config/database.js";
import { cleanupRefreshTokens } from "../src/jobs/refresh-token-cleanup.job.js";

// Top-level await works in ES modules: no wrapper function needed
try {
  const count = await cleanupRefreshTokens();
  console.log(`Deleted ${count} expired refresh tokens`);
} catch (error) {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect(); // a one-off script must close the pool, or it never exits
}
