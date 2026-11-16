import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("GET /api/health", () => {
  it("reports the API and the database as up", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok", database: "up" } });
  });
});

describe("unknown routes and bad input", () => {
  it("returns a JSON 404 for an unknown route", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a JSON 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": broken');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
