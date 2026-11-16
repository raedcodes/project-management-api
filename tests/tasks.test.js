import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { jwtConfig } from "../src/config/jwt.js";
import { authHeader, createTask, createUser, resetDatabase } from "./helpers.js";

let owner;
let other;

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser();
  other = await createUser();
});

describe("authentication on /api/tasks", () => {
  it("rejects a request without a token (401)", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an expired token (401 TOKEN_EXPIRED)", async () => {
    const expired = jwt.sign(
      { sub: owner.id, exp: Math.floor(Date.now() / 1000) - 10 },
      jwtConfig.secret,
      { algorithm: jwtConfig.algorithm },
    );
    const res = await request(app).get("/api/tasks").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("rejects a token signed with another secret (401 INVALID_TOKEN)", async () => {
    const forged = jwt.sign({ sub: owner.id }, "attacker-secret-attacker-secret-1234");
    const res = await request(app).get("/api/tasks").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});

describe("POST /api/tasks", () => {
  it("creates a task with database defaults and a trimmed title", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader(owner))
      .send({ title: "  Learn testing  " });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: "Learn testing",
      status: "pending",
      priority: "low",
      description: null,
      dueDate: null,
      userId: owner.id,
    });
  });

  it("converts a due date with a timezone to UTC", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .set(authHeader(owner))
      .send({ title: "Due", dueDate: "2026-12-01T09:00:00+02:00" });

    expect(res.status).toBe(201);
    expect(res.body.data.dueDate).toBe("2026-12-01T07:00:00.000Z");
  });

  it.each([
    ["a missing title", {}, "title"],
    ["a blank title", { title: "   " }, "title"],
    ["a 151-character title", { title: "x".repeat(151) }, "title"],
    ["an unknown status", { title: "x", status: "done" }, "status"],
    ["a date without a time", { title: "x", dueDate: "2026-12-01" }, "dueDate"],
    ["a userId field", { title: "x", userId: "someone-else" }, "userId"],
  ])("rejects %s (400)", async (_label, body, field) => {
    const res = await request(app).post("/api/tasks").set(authHeader(owner)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns the owner's task, including its tags", async () => {
    const task = await createTask(owner, { title: "Mine" });

    const res = await request(app).get(`/api/tasks/${task.id}`).set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: task.id, title: "Mine", tags: [] });
  });

  it("returns 404, not 403, for another user's task", async () => {
    const task = await createTask(owner);

    const res = await request(app).get(`/api/tasks/${task.id}`).set(authHeader(other));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for an id that isn't a UUID", async () => {
    const res = await request(app).get("/api/tasks/not-a-uuid").set(authHeader(owner));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/tasks/:id", () => {
  it("changes only the fields that were sent", async () => {
    const task = await createTask(owner, { title: "Keep", description: "keep me", priority: "high" });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(authHeader(owner))
      .send({ status: "completed" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: "Keep",
      description: "keep me",
      priority: "high",
      status: "completed",
    });
  });

  it("clears a field when null is sent explicitly", async () => {
    const task = await createTask(owner, { description: "remove me" });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(authHeader(owner))
      .send({ description: null });

    expect(res.body.data.description).toBeNull();
  });

  it("rejects an empty body (400)", async () => {
    const task = await createTask(owner);
    const res = await request(app).patch(`/api/tasks/${task.id}`).set(authHeader(owner)).send({});
    expect(res.status).toBe(400);
  });

  it("cannot change another user's task (404) and leaves it untouched", async () => {
    const task = await createTask(owner, { title: "Original" });

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .set(authHeader(other))
      .send({ title: "Hijacked" });

    expect(res.status).toBe(404);
    const check = await request(app).get(`/api/tasks/${task.id}`).set(authHeader(owner));
    expect(check.body.data.title).toBe("Original");
  });
});

describe("PUT /api/tasks/:id", () => {
  it("replaces the task: fields that weren't sent go back to their defaults", async () => {
    const task = await createTask(owner, {
      title: "Old",
      description: "old",
      status: "completed",
      priority: "high",
      dueDate: new Date("2026-12-01T00:00:00Z"),
    });

    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set(authHeader(owner))
      .send({ title: "New" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: "New",
      description: null,
      status: "pending",
      priority: "low",
      dueDate: null,
    });
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("deletes the task (204), then it's gone (404)", async () => {
    const task = await createTask(owner);

    const first = await request(app).delete(`/api/tasks/${task.id}`).set(authHeader(owner));
    const second = await request(app).delete(`/api/tasks/${task.id}`).set(authHeader(owner));

    expect(first.status).toBe(204);
    expect(first.text).toBe("");
    expect(second.status).toBe(404);
  });

  it("cannot delete another user's task (404)", async () => {
    const task = await createTask(owner);
    const res = await request(app).delete(`/api/tasks/${task.id}`).set(authHeader(other));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/tasks (list)", () => {
  const titles = (res) => res.body.data.map((t) => t.title);

  it("paginates with meta, and only ever shows the user's own tasks", async () => {
    for (let i = 1; i <= 12; i++) {
      await createTask(owner, { title: `Task ${i}` });
    }
    await createTask(other, { title: "Not yours" });

    const page2 = await request(app).get("/api/tasks?page=2&limit=5").set(authHeader(owner));

    expect(page2.status).toBe(200);
    expect(page2.body.meta).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(page2.body.data).toHaveLength(5);
    expect(titles(page2)).not.toContain("Not yours");
  });

  it("returns an empty page, not an error, past the last page", async () => {
    await createTask(owner);
    const res = await request(app).get("/api/tasks?page=99").set(authHeader(owner));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(1);
  });

  it("filters by status and priority together", async () => {
    await createTask(owner, { title: "match", status: "pending", priority: "high" });
    await createTask(owner, { title: "wrong status", status: "completed", priority: "high" });
    await createTask(owner, { title: "wrong priority", status: "pending", priority: "low" });

    const res = await request(app)
      .get("/api/tasks?status=pending&priority=high")
      .set(authHeader(owner));

    expect(titles(res)).toEqual(["match"]);
  });

  it("searches titles case-insensitively, and treats % as a literal character", async () => {
    await createTask(owner, { title: "Buy MILK" });
    await createTask(owner, { title: "100% done" });
    await createTask(owner, { title: "Something else" });

    const milk = await request(app).get("/api/tasks?search=milk").set(authHeader(owner));
    const percent = await request(app).get("/api/tasks?search=%25").set(authHeader(owner));

    expect(titles(milk)).toEqual(["Buy MILK"]);
    expect(titles(percent)).toEqual(["100% done"]);
  });

  it("sorts by due date with tasks that have no due date last", async () => {
    await createTask(owner, { title: "none" });
    await createTask(owner, { title: "later", dueDate: new Date("2026-12-10T00:00:00Z") });
    await createTask(owner, { title: "sooner", dueDate: new Date("2026-12-01T00:00:00Z") });

    const res = await request(app)
      .get("/api/tasks?sortBy=dueDate&order=asc")
      .set(authHeader(owner));

    expect(titles(res)).toEqual(["sooner", "later", "none"]);
  });

  it("never repeats or skips a task across pages, even when sort values are equal", async () => {
    const sameDate = new Date("2026-12-01T00:00:00Z");
    for (let i = 0; i < 9; i++) {
      await createTask(owner, { title: `same-${i}`, dueDate: i % 3 === 0 ? null : sameDate });
    }

    const ids = [];
    for (const page of [1, 2, 3]) {
      const res = await request(app)
        .get(`/api/tasks?sortBy=dueDate&order=asc&limit=3&page=${page}`)
        .set(authHeader(owner));
      ids.push(...res.body.data.map((t) => t.id));
    }

    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
  });

  it.each([["limit=101"], ["limit=0"], ["page=abc"], ["pgae=2"], ["sortBy=password"]])(
    "rejects ?%s (400)",
    async (query) => {
      const res = await request(app).get(`/api/tasks?${query}`).set(authHeader(owner));
      expect(res.status).toBe(400);
    },
  );
});
