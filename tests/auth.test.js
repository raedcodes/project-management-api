import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { PASSWORD, createUser, resetDatabase } from "./helpers.js";

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
