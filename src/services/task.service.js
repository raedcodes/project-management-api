import { prisma } from "../config/database.js";
import { taskEvents } from "../events/task.events.js";
import { AppError } from "../utils/app-error.js";
import { invalidateTaskLists } from "./task-cache.service.js";

// Prisma error code for "record to update/delete was not found"
const RECORD_NOT_FOUND = "P2025";

// The only fields a client may set (like Laravel's $fillable).
// Fields not sent stay undefined, and Prisma skips undefined:
// on create the DB default applies, on PATCH the column is left unchanged.
const pickTaskFields = (input) => ({
  title: input.title,
  description: input.description,
  status: input.status,
  priority: input.priority,
  dueDate: input.dueDate,
});

// Prisma doesn't escape LIKE wildcards on MySQL: without this, searching "%" matches every title
const escapeLike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

// One page of the user's tasks, plus the total number of matches
const listTasks = async (
  userId,
  { page, limit, search, status, priority, sortBy, order },
) => {
  const where = {
    userId,
    // Filters that weren't sent are undefined, and Prisma ignores undefined
    status,
    priority,
    // Case-insensitive already, thanks to the table collation (utf8mb4_unicode_ci)
    title: search ? { contains: escapeLike(search) } : undefined,
  };

  // One transaction: the page and the total see the same data
  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: [
        // Tasks without a due date go last in both directions
        sortBy === "dueDate"
          ? { dueDate: { sort: order, nulls: "last" } }
          : { [sortBy]: order },
        // Tie-breaker: equal sort values keep a fixed order, so pages never overlap or skip
        { id: order },
      ],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        tags: true,
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
};

// null when the task doesn't exist OR belongs to another user
const showTask = (userId, id) =>
  prisma.task.findFirst({
    where: { id, userId },
    include: {
      tags: true,
    },
  });

// Every write clears the user's cached task lists, and waits for it, so the client's
// next GET /tasks already sees the change.
const createTask = async (userId, input) => {
  const task = await prisma.task.create({
    data: { ...pickTaskFields(input), userId },
  });
  await invalidateTaskLists(userId);
  return task;
};

// PATCH: change only the fields that were sent
const updateTask = (userId, id, input) =>
  updateOwnedTask(userId, id, pickTaskFields(input));

// PUT: replace every field; omitted ones go back to null / the schema defaults
const replaceTask = (userId, id, input) =>
  updateOwnedTask(userId, id, {
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "pending",
    priority: input.priority ?? "low",
    dueDate: input.dueDate ?? null,
  });

// One atomic update that only matches if the task belongs to userId.
// Returns null when there's no match; any other error is re-thrown.
const updateOwnedTask = async (userId, id, data) => {
  // To detect the change to "completed", we need the old status (only read when it matters)
  let previousStatus;
  if (data.status === "completed") {
    const current = await prisma.task.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    previousStatus = current?.status;
  }

  let task;
  try {
    task = await prisma.task.update({ where: { id, userId }, data });
  } catch (error) {
    if (error.code === RECORD_NOT_FOUND) {
      return null;
    }
    throw error;
  }

  await invalidateTaskLists(userId);

  // Only when the status changes to completed: saving a completed task again sends nothing
  if (data.status === "completed" && previousStatus !== "completed") {
    taskEvents.emit("task.completed", task);
  }
  return task;
};

const deleteTask = async (userId, id) => {
  try {
    await prisma.task.delete({ where: { id, userId } });
    await invalidateTaskLists(userId);
    return true;
  } catch (error) {
    if (error.code === RECORD_NOT_FOUND) {
      return false;
    }
    throw error;
  }
};

const assignTagsToTask = async (userId, taskId, tagIds) => {
  try {
    // Validate that all provided tag IDs exist in the database
    const uniqueIds = [...new Set(tagIds)]; // ignore duplicates like ["a", "a"]
    const existing = await prisma.tag.count({
      where: { id: { in: uniqueIds } },
    });
    if (existing !== uniqueIds.length) {
      throw new AppError(400, "INVALID_TAGS", "One or more tags do not exist");
    }

    const task = await prisma.task.update({
      where: { id: taskId, userId },
      data: {
        tags: {
          set: uniqueIds.map((tagId) => ({ id: tagId })), // Replace existing tags with new ones
        },
      },
      include: {
        tags: true, // Include the updated tags in the response
      },
    });
    await invalidateTaskLists(userId); // the list includes tags
    return task;
  } catch (error) {
    if (error.code === RECORD_NOT_FOUND) {
      return null;
    }
    throw error;
  }
};

export {
  listTasks,
  showTask,
  createTask,
  updateTask,
  replaceTask,
  deleteTask,
  assignTagsToTask,
};
