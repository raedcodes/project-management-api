import { execSync } from "node:child_process";
import dotenv from "dotenv";

export const TEST_DATABASE = "task_api_test";

// Runs once, before any test file: applies all migrations to the TEST database.
// Credentials come from .env; only the database name is swapped.
export default function setup() {
  const env = { ...process.env };
  dotenv.config({ processEnv: env, quiet: true });

  const user = env.DATABASE_USER;
  const password = encodeURIComponent(env.DATABASE_PASSWORD);
  const host = `${env.DATABASE_HOST}:${env.DATABASE_PORT}`;
  env.DATABASE_URL = `mysql://${user}:${password}@${host}/${TEST_DATABASE}`;

  // Same command production uses: applies pending migrations, never resets or prompts
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
}
