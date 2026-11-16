import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { PASSWORD, createUser, resetDatabase } from "./helpers.js";

// Each test file gets a fresh copy of the app, so the in-memory limiter counters start at 0 here.

beforeAll(async () => {
  await resetDatabase();
  await createUser({ email: "limited@example.com" });
});

const login = (password) =>
  request(app).post("/api/auth/login").send({ email: "limited@example.com", password });

describe("login rate limit (5 failures per 15 minutes)", () => {
  it("does not count successful logins", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await login(PASSWORD);
      expect(res.status).toBe(200);
    }
  });

  it("blocks the 6th failure with 429, Retry-After and the JSON error format", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await login("wrong")).status).toBe(401);
    }

    const blocked = await login("wrong");

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");
  });

  it("then refuses even the correct password from the same IP", async () => {
    expect((await login(PASSWORD)).status).toBe(429);
  });
});

describe("register rate limit (10 requests per hour, successful or not)", () => {
  it("blocks the 11th registration attempt", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Bot", email: `bot${i}@example.com`, password: PASSWORD });
      expect(res.status).toBe(201);
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .send({ name: "Bot", email: "bot10@example.com", password: PASSWORD });

    expect(blocked.status).toBe(429);
  });
});
