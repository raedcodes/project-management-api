//builds and configures the Express app (middleware, routes) and exports it. It never opens a port.
import express from "express";
import taskRoutes from "./routes/task.routes.js";
import helmet from "helmet";
import cors from "cors";
import { prisma } from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import authenticate from "./middlewares/auth.middleware.js";
import notFound from "./middlewares/not-found.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import { sendError, sendSuccess } from "./utils/api-response.js";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";

// OpenAPI spec, read once at startup. ES modules have no __dirname, so the path is
// resolved relative to this file (works whatever folder the server is started from).
const openApiSpec = YAML.parse(
  readFileSync(new URL("../docs/openapi.yaml", import.meta.url), "utf8"),
);

// Create express app
const app = express();

//logger
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    // Keep test output readable: no per-request log lines under Vitest
    if (process.env.NODE_ENV === "test") {
      return;
    }
    const duration = Date.now() - start;

    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
});

// Allowed browser origins from CORS_ORIGIN (comma-separated). Missing/empty = allow none.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));

// Parse JSON bodies (100kb is the default; stated explicitly as a deliberate limit)
app.use(express.json({ limit: "100kb" }));

//health route
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    sendSuccess(res, { status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check: database unreachable:", error.message);
    sendError(res, 503, "DB_DOWN", "Database is unreachable");
  }
});

// API documentation (public): interactive UI, plus the raw spec for tools like Bruno
app.get("/api/docs.json", (req, res) => res.json(openApiSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Public auth routes
app.use("/api/auth", authRoutes);

// Protected task routes: every request needs a valid token
app.use("/api/tasks", authenticate, taskRoutes);

// Must stay last: unmatched routes → 404, then every error → JSON
app.use(notFound);
app.use(errorHandler);

export default app;
