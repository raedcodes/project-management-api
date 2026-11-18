import { Redis } from "ioredis";

// Used as a cache only: if Redis is down, the app keeps working from the database.
export const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    // Fail commands immediately while disconnected. With the default (queue and retry),
    // a request waited 3+ seconds when Redis was down.
    enableOfflineQueue: false,
});

// Log once when Redis goes away and once when it's back, not on every reconnect attempt
let down = false;
redis.on("error", (error) => {
    if (!down) {
        down = true;
        console.error("Redis unavailable, serving from the database:", error.message);
    }
});
redis.on("ready", () => {
    if (down) {
        console.log("Redis is back, caching resumed");
    }
    down = false;
});
