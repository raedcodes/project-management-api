import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../src/config/database.js";
import { jwtConfig } from "../src/config/jwt.js";
import { TEST_DATABASE } from "./setup/global-setup.js";

export const PASSWORD = "password123";

// Empties every table. Refuses to run unless connected to the test database.
export const resetDatabase = async () => {
  if (process.env.DATABASE_NAME !== TEST_DATABASE) {
    throw new Error(`Refusing to wipe "${process.env.DATABASE_NAME}": tests must use ${TEST_DATABASE}`);
  }
  await prisma.task.deleteMany(); // join rows in _TagToTask go with them (cascade)
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
};

let userCounter = 0;

// Creates a user straight in the database (not via /register, which is rate-limited).
// Cost 4 instead of 12 keeps tests fast; bcrypt.compare works with any cost.
export const createUser = async ({ name = "Test User", email, password = PASSWORD } = {}) => {
  userCounter += 1;
  return prisma.user.create({
    data: {
      name,
      email: email ?? `user${userCounter}-${Date.now()}@example.com`,
      password: await bcrypt.hash(password, 4),
    },
  });
};

// A valid token for this user, signed exactly like the app signs them
export const authHeader = (user) => {
  const token = jwt.sign({ sub: user.id }, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    expiresIn: "5m",
  });
  return { Authorization: `Bearer ${token}` };
};

export const createTask = (user, data = {}) =>
  prisma.task.create({ data: { title: "Test task", ...data, userId: user.id } });

export const createTag = (name) => prisma.tag.create({ data: { name } });

export { prisma };
