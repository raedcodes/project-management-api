import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/database.js";

// Local development login only: never run this seed against production
const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "password123";

const seed = async () => {
  const user = await seedUser(DEV_EMAIL, DEV_PASSWORD);

  await seedTasks(user.id);

  await seedTags();

  console.log(`Seed done! Log in as ${DEV_EMAIL} / ${DEV_PASSWORD} (user id ${user.id})`);
};

const seedUser = async (email, password) => {
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: { email, name: "Dev User", password: hashedPassword },
  });

  console.log(`Seeded user: ${email} (id ${user.id})`);
  return user;
}

// 25 sample tasks for trying pagination, filters and sorting. Their titles start with
// "[seed]" so a re-run can tell they exist and skip them (your own tasks don't affect it).
const SEED_PREFIX = "[seed]";
const STATUSES = ["pending", "in_progress", "completed"];
const PRIORITIES = ["low", "medium", "high"];

const seedTasks = async (userId) => {
  const existing = await prisma.task.count({
    where: { userId, title: { startsWith: SEED_PREFIX } },
  });
  if (existing > 0) {
    console.log(`Sample tasks already exist (${existing}), skipping`);
    return;
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const tasks = Array.from({ length: 25 }, (_, i) => ({
    userId,
    title: `${SEED_PREFIX} Sample task ${String(i + 1).padStart(2, "0")}`,
    status: STATUSES[i % 3],
    priority: PRIORITIES[i % 3 === 0 ? 2 : i % 2],
    // Every 4th task has no due date, and tasks share due dates in pairs: shows nulls-last and the tie-breaker
    dueDate: i % 4 === 0 ? null : new Date(now + Math.floor(i / 2) * day),
    // Spread creation times so "newest first" is visible
    createdAt: new Date(now - (25 - i) * 60 * 1000),
  }));

  await prisma.task.createMany({ data: tasks });
  console.log(`Created ${tasks.length} sample tasks`);
};

const seedTags = async () => {
  await prisma.tag.upsert({
    where: { name: "Important" },
    update: {},
    create: { name: "Important" },
  });

  console.log("Seeded tag: Important");
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
