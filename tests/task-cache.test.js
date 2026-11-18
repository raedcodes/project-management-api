import { once } from "node:events";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { redis } from "../src/config/redis.js";
import { authHeader, createTask, createUser, resetDatabase } from "./helpers.js";

let owner;
let other;

// Commands fail fast while Redis is still connecting (by design), so wait until it's ready
beforeAll(async () => {
  if (redis.status !== "ready") {
    await once(redis, "ready");
  }
});

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser();
  other = await createUser();
});

const list = (user, query = "") => request(app).get(`/api/tasks${query}`).set(authHeader(user));

describe("GET /api/tasks cache", () => {
  it("serves a repeated request from the cache", async () => {
    await createTask(owner, { title: "Cached" });

    const first = await list(owner);
    const second = await list(owner);

    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body);
  });

  it("caches each query separately", async () => {
    await list(owner, "?page=1");

    const res = await list(owner, "?page=2");

    expect(res.headers["x-cache"]).toBe("MISS");
  });

  it("is cleared when a task is created", async () => {
    await list(owner);

    await request(app).post("/api/tasks").set(authHeader(owner)).send({ title: "New" });
    const res = await list(owner);

    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.meta.total).toBe(1);
  });

  it("is cleared when a task is updated or deleted", async () => {
    const task = await createTask(owner, { title: "Before" });
    await list(owner);

    await request(app).patch(`/api/tasks/${task.id}`).set(authHeader(owner)).send({ title: "After" });
    const afterUpdate = await list(owner);
    expect(afterUpdate.body.data[0].title).toBe("After");

    await request(app).delete(`/api/tasks/${task.id}`).set(authHeader(owner));
    const afterDelete = await list(owner);
    expect(afterDelete.body.data).toEqual([]);
  });

  it("never serves one user's cached list to another user", async () => {
    await createTask(owner, { title: "Private" });
    await list(owner);

    const res = await list(other);

    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.body.data).toEqual([]);
  });
});
