import { z } from "zod";
import { TaskPriority, TaskStatus } from "../generated/prisma/enums.ts";

const taskIdParamsSchema = z.object({
  id: z.uuid(),
});

// POST. Strict: unknown keys (typos like "titel", or "userId") are rejected, not silently dropped.
const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  // Allowed values come from the Prisma schema, so they're defined in one place only
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  // Strict ISO 8601 with a timezone. Not z.coerce.date(): it turns null into 1970-01-01.
  dueDate: z.iso
    .datetime({ offset: true })
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
});

// PUT: same rules (title required); omitted fields are reset to defaults by the service
const replaceTaskSchema = createTaskSchema;

// PATCH: every field optional, but an empty body is rejected
const updateTaskSchema = createTaskSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: "Provide at least one field to update",
  });

// GET /api/tasks query string. Every value arrives as text (or an array if repeated),
// so numbers are coerced and everything is constrained. Strict: typos like ?pgae=2 → 400.
const listTasksQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10), // capped: no unbounded result sets
  // An empty ?search= is treated as "no search"
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  // Only known columns: a query value is never used directly as a column name
  sortBy: z.enum(["createdAt", "dueDate"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const assignTagsToTaskSchema = z.strictObject({
  tagIds: z.array(z.uuid()).max(20)
});

export {
  taskIdParamsSchema,
  createTaskSchema,
  replaceTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  assignTagsToTaskSchema, 
};
