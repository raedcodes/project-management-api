import { prisma } from "../config/database.js";

// Deletes refresh tokens past their expiry date, used or not.
// Used (revoked) tokens are deliberately kept until then: if a stolen copy is replayed,
// the row must still exist so refresh() can detect the reuse and end all sessions.
// Once expired, a replayed token is useless anyway, so the row can go.
const cleanupRefreshTokens = async () => {
    const { count } = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
    return count;
};

export { cleanupRefreshTokens };
