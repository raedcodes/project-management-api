import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("API documentation", () => {
  it("serves the raw OpenAPI spec", async () => {
    const res = await request(app).get("/api/docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
  });

  it("documents every endpoint the API has", async () => {
    const { body: spec } = await request(app).get("/api/docs.json");

    const documented = Object.entries(spec.paths).flatMap(([path, item]) =>
      Object.keys(item)
        .filter((key) => ["get", "post", "put", "patch", "delete"].includes(key))
        .map((method) => `${method.toUpperCase()} ${path}`),
    );

    // Update this list (and docs/openapi.yaml) whenever a route is added
    expect(documented.sort()).toEqual(
      [
        "GET /api/health",
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET /api/tasks",
        "POST /api/tasks",
        "GET /api/tasks/{id}",
        "PUT /api/tasks/{id}",
        "PATCH /api/tasks/{id}",
        "DELETE /api/tasks/{id}",
        "PUT /api/tasks/{id}/tags",
      ].sort(),
    );
  });

  it("serves the Swagger UI page without needing a token", async () => {
    const res = await request(app).get("/api/docs/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui");
  });
});
