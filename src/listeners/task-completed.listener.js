import { prisma } from "../config/database.js";
import { mailer, mailFrom } from "../config/mail.js";
import { taskEvents } from "../events/task.events.js";

export const sendTaskCompletedEmail = async (task) => {
    const user = await prisma.user.findUnique({
        where: { id: task.userId },
        select: { email: true, name: true },
    });
    if (!user) {
        return; // the account was deleted in the meantime
    }

    await mailer.sendMail({
        from: mailFrom,
        to: user.email,
        subject: `Task completed: ${task.title}`,
        // Plain text only. If you add `html`, escape the title: it's user input.
        text: `Hi ${user.name},\n\nYou completed "${task.title}". Nice work!\n`,
    });
};

// EventEmitter doesn't wait for listeners or catch their errors. An async listener that
// rejects is an unhandled rejection, which crashes the whole server. So: catch here.
taskEvents.on("task.completed", async (task) => {
    try {
        await sendTaskCompletedEmail(task);
    } catch (error) {
        console.error("Failed to send task-completed email:", error);
    }
});
