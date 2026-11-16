import express from "express";
import {
  createTask,
  deleteTask,
  getTasks,
  replaceTask,
  showTask,
  updateTask,
  assignTagsToTask,
} from "../controllers/task.controller.js";
import validate from "../middlewares/validate.middleware.js";
import {
  createTaskSchema,
  listTasksQuerySchema,
  replaceTaskSchema,
  taskIdParamsSchema,
  updateTaskSchema,
  assignTagsToTaskSchema
} from "../validators/task.validator.js";

const router = express.Router();

//CRUD routes for tasks
router.get("/", validate({ query: listTasksQuerySchema }), getTasks);
router.get("/:id", validate({ params: taskIdParamsSchema }), showTask);
router.post("/", validate({ body: createTaskSchema }), createTask);
router.patch("/:id", validate({ params: taskIdParamsSchema, body: updateTaskSchema }), updateTask);
router.put("/:id", validate({ params: taskIdParamsSchema, body: replaceTaskSchema }), replaceTask);
router.delete("/:id", validate({ params: taskIdParamsSchema }), deleteTask);

// Assign tags to a task
router.put("/:id/tags", validate({ params: taskIdParamsSchema , body: assignTagsToTaskSchema }), assignTagsToTask);

export default router;
