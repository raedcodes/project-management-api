import * as taskService from "../services/task.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

// Ownership is enforced inside the service queries: a task that doesn't exist
// and a task owned by someone else both come back as null → 404.
const taskNotFound = () => new AppError(404, "NOT_FOUND", "Task not found");

const getTasks = async (req, res) => {
  // Parsed by validate(): numbers coerced, defaults applied (Express 5's req.query is read-only)
  const query = req.validatedQuery;
  const { tasks, total } = await taskService.listTasks(req.user.id, query);

  return sendSuccess(res, tasks, 200, {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
};

const showTask = async (req, res) => {
  const task = await taskService.showTask(req.user.id, req.params.id);
  if (!task) {
    throw taskNotFound();
  }
  return sendSuccess(res, task);
};

const createTask = async (req, res) => {
  const task = await taskService.createTask(req.user.id, req.body);
  return sendSuccess(res, task, 201);
};

const updateTask = async (req, res) => {
  const task = await taskService.updateTask(req.user.id, req.params.id, req.body);
  if (!task) {
    throw taskNotFound();
  }
  return sendSuccess(res, task);
};

const replaceTask = async (req, res) => {
  const task = await taskService.replaceTask(req.user.id, req.params.id, req.body);
  if (!task) {
    throw taskNotFound();
  }
  return sendSuccess(res, task);
};

const deleteTask = async (req, res) => {
  const deleted = await taskService.deleteTask(req.user.id, req.params.id);
  if (!deleted) {
    throw taskNotFound();
  }
  return res.status(204).end();
};

const assignTagsToTask = async (req, res) => {
  const task = await taskService.assignTagsToTask(req.user.id, req.params.id, req.body.tagIds);
  if (!task) {
    throw taskNotFound();
  }
  return sendSuccess(res, task);
};

export { getTasks, showTask, createTask, updateTask, replaceTask, deleteTask, assignTagsToTask };
