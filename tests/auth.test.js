import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { PASSWORD, createUser, prisma, resetDatabase } from "./helpers.js";

// Note: the register limiter allows 10 requests per file run, the login limiter 5 failures.
// This file stays under both; rate limiting itself is tested in rate-limit.test.js.

beforeEach(resetDatabase);

describe("POST /api/auth/register", () => {
  it("creates a user, normalises the email and never returns the password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "  Ana  ", email: "  Ana@Example.COM ", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: "Ana", email: "ana@example.com" });
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it("rejects an email that is already registered, in any letter case (409)", async () => {
    await createUser({ email: "taken@example.com" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Copy", email: "TAKEN@example.com", password: PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it.each([
    ["a short password", { password: "1234567" }, "password"],
    ["a password over 72 bytes", { password: "a".repeat(73) }, "password"],
    ["an invalid email", { email: "not-an-email" }, "email"],
    ["an unknown field", { role: "admin" }, "role"],
  ])("rejects %s (400)", async (_label, override, field) => {
    const body = { name: "Ana", email: "ana@example.com", password: PASSWORD, ...override };

    const res = await request(app).post("/api/auth/register").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.field)).toContain(field);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token that carries only the user id", async () => {
    const user = await createUser({ email: "login@example.com" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Login@Example.com", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user).not.toHaveProperty("password");
    const payload = JSON.parse(Buffer.from(res.body.data.token.split(".")[1], "base64url"));
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "sub"]);
    expect(payload.sub).toBe(user.id);
  });

  it("answers a wrong password and an unknown email identically (no account enumeration)", async () => {
    await createUser({ email: "known@example.com" });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "known@example.com", password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

// Creates a user and logs in through the API, returning { user, token, refreshToken }
const loginAs = async (email) => {
  await createUser({ email });
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.data;
};

const refresh = (refreshToken) => request(app).post("/api/auth/refresh").send({ refreshToken });

describe("POST /api/auth/refresh", () => {
  it("returns a working new token pair, and the old refresh token stops working", async () => {
    const { refreshToken } = await loginAs("rotate@example.com");

    const res = await refresh(refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(refreshToken);

    const tasks = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${res.body.data.token}`);
    expect(tasks.status).toBe(200);

    const reused = await refresh(refreshToken);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("revokes every session when a used refresh token comes back (theft detection)", async () => {
    const { refreshToken: stolen } = await loginAs("theft@example.com");
    const { body } = await refresh(stolen); // the real user refreshes
    const current = body.data.refreshToken;

    await refresh(stolen); // the thief replays the old token

    const res = await refresh(current); // the real user is logged out too
    expect(res.status).toBe(401);
  });

  it("rejects an expired refresh token (401)", async () => {
    const { refreshToken } = await loginAs("expired@example.com");
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
  });

  it("rejects a token it never issued (401)", async () => {
    const res = await refresh("not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the refresh token; logging out twice is fine (204)", async () => {
    const { refreshToken } = await loginAs("logout@example.com");

    const first = await request(app).post("/api/auth/logout").send({ refreshToken });
    const second = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const res = await refresh(refreshToken);
    expect(res.status).toBe(401);
  });
});
