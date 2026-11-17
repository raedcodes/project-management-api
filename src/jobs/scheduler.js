import cron from "node-cron";
import { cleanupRefreshTokens } from "./refresh-token-cleanup.job.js";

// Wraps a job so a failure is logged, never silently lost and never crashes the server
const run = (name, job) => async () => {
    try {
        const result = await job();
        console.log(`[cron] ${name} finished:`, result);
    } catch (error) {
        console.error(`[cron] ${name} failed:`, error);
    }
};

// Runs inside this Node process (no system crontab needed, unlike Laravel's schedule:run).
// Times are the server's local time.
const startScheduler = () => [
    cron.schedule("0 3 * * *", run("cleanup-refresh-tokens", cleanupRefreshTokens), {
        name: "cleanup-refresh-tokens",
        noOverlap: true, // if a run is still going at the next tick, skip instead of stacking
    }),
];

export { startScheduler };
