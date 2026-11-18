import { redis } from "../config/redis.js";

const TTL_SECONDS = 60; // safety net for changes that bypass the API (seed, Prisma Studio)

// Every key contains the userId: a key without it would serve one user's tasks to another
const versionKey = (userId) => `tasks:${userId}:version`;

// Cache-aside, like Laravel's Cache::remember. Redis errors never fail the request:
// they're logged by the client, and we fall back to the database.
export const rememberTaskList = async (userId, query, load) => {
    let key;
    try {
        const version = (await redis.get(versionKey(userId))) ?? "0";
        // validatedQuery always has the same key order (Zod's schema order), so equal queries match
        key = `tasks:${userId}:v${version}:list:${JSON.stringify(query)}`;

        const cached = await redis.get(key);
        if (cached !== null) {
            return { ...JSON.parse(cached), cacheHit: true };
        }
    } catch {
        // Redis unavailable: fall through to the database
    }

    const result = await load();

    if (key) {
        try {
            await redis.set(key, JSON.stringify(result), "EX", TTL_SECONDS);
        } catch {
            // Not cached this time; the next request tries again
        }
    }
    return { ...result, cacheHit: false };
};

// Called after every write. A new version makes all of this user's cached lists unreachable;
// they expire on their own. If Redis is down, the TTL limits staleness to 60 seconds.
export const invalidateTaskLists = async (userId) => {
    try {
        await redis.incr(versionKey(userId));
    } catch {
        // See above: the TTL is the fallback
    }
};
