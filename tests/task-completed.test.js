import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { mailer } from "../src/config/mail.js";
import { taskEvents } from "../src/events/task.events.js";
import { sendTaskCompletedEmail } from "../src/listeners/task-completed.listener.js";
import { authHeader, createTask, createUser, resetDatabase } from "./helpers.js";

let user;

beforeEach(async () => {
    await resetDatabase();
    user = await createUser({ name: "Ana", email: "ana@example.com" });
});

afterEach(() => vi.restoreAllMocks());

const completedEvents = (emitSpy) =>
    emitSpy.mock.calls.filter(([eventName]) => eventName === "task.completed");

const patch = (task, body) =>
    request(app).patch(`/api/tasks/${task.id}`).set(authHeader(user)).send(body);

describe("task.completed event", () => {
    it("fires once when a task becomes completed, not when it's saved as completed again", async () => {
        const emit = vi.spyOn(taskEvents, "emit");
        const task = await createTask(user);

        await patch(task, { status: "completed" });
        await patch(task, { status: "completed" });

        expect(completedEvents(emit)).toHaveLength(1);
        expect(completedEvents(emit)[0][1]).toMatchObject({ id: task.id, status: "completed" });
    });

    it("doesn't fire for other changes", async () => {
        const emit = vi.spyOn(taskEvents, "emit");
        const task = await createTask(user);

        await patch(task, { title: "Renamed", status: "in_progress" });

        expect(completedEvents(emit)).toHaveLength(0);
    });
});

describe("sendTaskCompletedEmail", () => {
    it("emails the task's owner", async () => {
        const sendMail = vi.spyOn(mailer, "sendMail").mockResolvedValue({});
        const task = await createTask(user, { title: "Write README", status: "completed" });

        await sendTaskCompletedEmail(task);

        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({ to: "ana@example.com", subject: "Task completed: Write README" }),
        );
    });
});
