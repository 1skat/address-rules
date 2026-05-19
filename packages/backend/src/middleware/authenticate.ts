import jwt from "jsonwebtoken"
import { tryCatch } from "@/utils/try-catch.js";
import type { Request, Response, NextFunction } from "express"
import { cfg } from "@/config.js";
import redis from "@/internal/redis.js"

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const header = req.headers.authorization;
        if (!header) return res.status(401).json("");

        const parts = header.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) return res.status(401).json("");

        const token = parts[1];

        const payload = jwt.verify(token, cfg.jwt.pubKey, { algorithms: ["ES256"] }) as { sub: string, parent_id: string };

        if (!isValidRT(payload.sub, payload.parent_id)) {
            return res.status(401).json("");
        }

        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json("")
    }
}

export async function isValidRT(accountId: string, jti: string) {
    const addedAt = await redis.zScore(`user_sessions:${accountId}`, jti);
    if (addedAt === null || addedAt <= Date.now()) {
        await redis.zRem(`account_sessions:${accountId}`, jti);
        return false;
    }

    return true;
}
