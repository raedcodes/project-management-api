# Task Management API

A REST API for personal task management, built with Node.js, Express 5, Prisma and MySQL.
Each user manages their own tasks; tags can be attached to tasks.

## Features

- **Auth:** register and login with JWT access tokens (15 min) and rotating refresh tokens (7 days).
  A reused refresh token ends every session of that user. Logout revokes the refresh token.
- **Tasks:** create, read, update (`PATCH`), replace (`PUT`) and delete, scoped to the logged-in user.
  Another user's task always answers `404`.
- **Listing:** pagination, filtering by status and priority, title search, sorting by creation or due date.
- **Tags:** global tags attached to tasks with `PUT /api/tasks/:id/tags`.
- **Validation:** request bodies, route parameters and query strings are validated with Zod; unknown body
  and query fields are rejected.
- **Security:** bcrypt password hashing, rate limits on login and register, Helmet headers, CORS allow-list.
- **Scheduled job:** expired refresh tokens are deleted every night at 03:00.
- **Docs and tests:** OpenAPI 3.1 with Swagger UI, Vitest + Supertest suite, Bruno collection.

## Tech stack

| Area        | Tools                                          |
| ----------- | ---------------------------------------------- |
| Runtime     | Node.js 26, JavaScript (ES modules)            |
| Framework   | Express 5                                      |
| Database    | MySQL 8.4 (Docker), Prisma 7                   |
| Validation  | Zod 4                                          |
| Auth        | jsonwebtoken, bcrypt                           |
| Jobs        | node-cron                                      |
| Testing     | Vitest, Supertest, Bruno CLI                   |
| Docs        | OpenAPI 3.1, Swagger UI                        |

## Getting started

### Requirements

- Node.js 26 (an `.nvmrc` is included: `nvm use`)
- Docker with Docker Compose

### 1. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env`:

- Set `MYSQL_ROOT_PASSWORD` and `DATABASE_PASSWORD` to strong values.
- Put the same `DATABASE_PASSWORD` into `DATABASE_URL` and `SHADOW_DATABASE_URL`.
- Set `JWT_SECRET` (at least 32 characters; the server refuses to start otherwise):

  ```bash
  openssl rand -hex 32
  ```

### 2. Start MySQL

```bash
docker compose up -d
```

MySQL listens on `127.0.0.1:3307`. On its first start it creates three databases:
`task_api` (the app), `task_api_shadow` (used by `prisma migrate dev`) and `task_api_test` (used by the tests).

### 3. Install, migrate and seed

```bash
npm install                 # also generates the Prisma client
npx prisma migrate dev      # creates the tables
npx prisma db seed          # dev user, 25 sample tasks and an "Important" tag
```

### 4. Run

```bash
npm run dev
```

The API runs on `http://localhost:3000`. Check it with `GET /api/health`.

**Dev login** (created by the seed): `dev@example.com` / `password123`

## API documentation

- **Swagger UI:** http://localhost:3000/api/docs
- **Raw OpenAPI spec:** http://localhost:3000/api/docs.json (source: [`docs/openapi.yaml`](docs/openapi.yaml))
- **Bruno collection:** open the [`Bruno/`](Bruno) folder in Bruno and select the `local` environment.
  Run **login** first; it stores the token for the other requests.

### Endpoints

| Method | Path                     | Auth | Description                                   |
| ------ | ------------------------ | ---- | --------------------------------------------- |
| GET    | `/api/health`            | No   | API and database status                       |
| POST   | `/api/auth/register`     | No   | Create an account (returns tokens)            |
| POST   | `/api/auth/login`        | No   | Log in (returns tokens)                       |
| POST   | `/api/auth/refresh`      | No   | Exchange a refresh token for a new token pair |
| POST   | `/api/auth/logout`       | No   | Revoke a refresh token                        |
| GET    | `/api/tasks`             | Yes  | List your tasks                               |
| POST   | `/api/tasks`             | Yes  | Create a task                                 |
| GET    | `/api/tasks/:id`         | Yes  | Show a task with its tags                     |
| PATCH  | `/api/tasks/:id`         | Yes  | Update some fields                            |
| PUT    | `/api/tasks/:id`         | Yes  | Replace a task                                |
| DELETE | `/api/tasks/:id`         | Yes  | Delete a task                                 |
| PUT    | `/api/tasks/:id/tags`    | Yes  | Set a task's tags                             |

Authenticated routes need `Authorization: Bearer <token>`.

**List query parameters** (`GET /api/tasks`): `page` (default 1), `limit` (1–100, default 10),
`search`, `status` (`pending`, `in_progress`, `completed`), `priority` (`low`, `medium`, `high`),
`sortBy` (`createdAt` or `dueDate`), `order` (`asc` or `desc`).

### Response format

```json
{ "success": true, "data": { ... }, "meta": { ... } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ ... ] } }
```

`meta` appears on paginated lists; `details` appears on validation errors.

## Scripts

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run dev`            | Start with auto-reload (nodemon)                                     |
| `npm start`              | Start without auto-reload                                            |
| `npm test`               | Run the Vitest suite against the `task_api_test` database            |
| `npm run test:watch`     | Run the tests in watch mode                                          |
| `npm run test:api`       | Run the Bruno collection (needs the server running and the seed)     |
| `npm run cleanup:tokens` | Delete expired refresh tokens now (the same job runs nightly)        |

Useful Prisma commands:

```bash
npx prisma migrate dev --name <change>   # create and apply a migration after editing schema.prisma
npx prisma generate                      # regenerate the client (migrate dev doesn't in Prisma 7)
npx prisma migrate reset                 # drop and recreate the dev database (then run db seed)
npx prisma studio                        # browse the data
```

## Tests

`npm test` runs against a separate `task_api_test` database, which the tests wipe as they go.
Migrations are applied to it automatically before the run, so the dev data is never touched.

## Project structure

```
src/
  app.js            Express app: middleware, routes, error handling (no port)
  server.js         Entry point: starts the HTTP server and the scheduler
  config/           Database client and JWT settings
  routes/           URL to controller mapping
  controllers/      Read the request, call a service, send the response
  services/         Business logic and database queries
  validators/       Zod schemas
  middlewares/      Auth, validation, rate limits, 404 and error handling
  jobs/             Scheduled jobs (node-cron)
  utils/            AppError and response helpers
prisma/             Schema, migrations and seed
docs/openapi.yaml   API specification
tests/              Vitest + Supertest tests
Bruno/              Bruno API collection
scripts/            One-off command-line scripts
```
