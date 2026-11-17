import { beforeEach, describe, expect, it } from "vitest";
import { cleanupRefreshTokens } from "../src/jobs/refresh-token-cleanup.job.js";
import { createUser, prisma, resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);

describe("cleanupRefreshTokens", () => {
  it("deletes only expired tokens, and keeps used ones until they expire", async () => {
    const user = await createUser();
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    await prisma.refreshToken.createMany({
      data: [
        { userId: user.id, tokenHash: "a".repeat(64), expiresAt: past }, // expired
        { userId: user.id, tokenHash: "b".repeat(64), expiresAt: past, revokedAt: past }, // expired + used
        { userId: user.id, tokenHash: "c".repeat(64), expiresAt: future }, // valid
        { userId: user.id, tokenHash: "d".repeat(64), expiresAt: future, revokedAt: past }, // used, keep for reuse detection
      ],
    });

    const deleted = await cleanupRefreshTokens();

    expect(deleted).toBe(2);
    const left = await prisma.refreshToken.findMany({ orderBy: { tokenHash: "asc" } });
    expect(left.map((token) => token.tokenHash[0])).toEqual(["c", "d"]);
  });
});
