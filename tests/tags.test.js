import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { authHeader, createTag, createTask, createUser, resetDatabase } from "./helpers.js";

let owner;
let task;
let important;
let urgent;

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser();
  task = await createTask(owner);
  important = await createTag("Important");
  urgent = await createTag("Urgent");
});

const putTags = (tagIds, { user = owner, taskId = task.id } = {}) =>
  request(app).put(`/api/tasks/${taskId}/tags`).set(authHeader(user)).send({ tagIds });

const tagNames = (res) => res.body.data.tags.map((t) => t.name).sort();

describe("PUT /api/tasks/:id/tags", () => {
  it("assigns tags to the task", async () => {
    const res = await putTags([important.id, urgent.id]);

    expect(res.status).toBe(200);
    expect(tagNames(res)).toEqual(["Important", "Urgent"]);
  });

  it("replaces the whole set (like Laravel's sync)", async () => {
    await putTags([important.id, urgent.id]);
    const res = await putTags([urgent.id]);

    expect(tagNames(res)).toEqual(["Urgent"]);
  });

  it("removes every tag when given an empty list", async () => {
    await putTags([important.id]);
    const res = await putTags([]);

    expect(res.status).toBe(200);
    expect(res.body.data.tags).toEqual([]);
  });

  it("ignores duplicate ids", async () => {
    const res = await putTags([important.id, important.id]);

    expect(res.status).toBe(200);
    expect(tagNames(res)).toEqual(["Important"]);
  });

  it("rejects a tag id that doesn't exist (400 INVALID_TAGS, not 'task not found')", async () => {
    const res = await putTags(["00000000-0000-0000-0000-000000000000"]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_TAGS");
  });

  it.each([
    ["a non-UUID id", ["abc"]],
    ["null", null],
    ["more than 20 ids", Array.from({ length: 21 }, () => "00000000-0000-0000-0000-000000000000")],
  ])("rejects %s (400 VALIDATION_ERROR)", async (_label, tagIds) => {
    const res = await putTags(tagIds);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("cannot tag another user's task (404)", async () => {
    const stranger = await createUser();
    const res = await putTags([important.id], { user: stranger });

    expect(res.status).toBe(404);
  });

  it("shows the tags when the task is read back", async () => {
    await putTags([important.id]);

    const res = await request(app).get(`/api/tasks/${task.id}`).set(authHeader(owner));

    expect(tagNames(res)).toEqual(["Important"]);
  });
});
