import jwt from "jsonwebtoken"
import type { Request, Response, NextFunction } from "express"
import { cfg } from "@/config.js";
import redis from "@/internal/redis.js"
import { WEB_TOKEN_CONFIG } from "@/index.js";

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const header = req.headers.authorization;
        if (!header) return res.status(401).end();

        const parts = header.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
            return res.status(401).json("");
        }

        const token = parts[1];

        const payload = jwt.verify(token, cfg.jwt.pubKey, { algorithms: ["ES256"], audience: "addressrules.xyz/access", issuer: "addressrules.xyz/signer" }) as { sub: string, parent_id: string, ver: number };
        if (WEB_TOKEN_CONFIG.baseClaim.ver !== payload.ver) {
            return res.status(403).end()
        }

        if (!await isValidRT(payload.sub, payload.parent_id)) {
            return res.status(403).end()
        }

        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).end();
    }
}

export const verifyAuth = async (header: string) => { // used in express midleware and ws
    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return null
    }

    const token = parts[1];

    const payload = jwt.verify(token, cfg.jwt.pubKey, {
        algorithms: ["ES256"],
        audience: "addressrules.xyz/access",
        issuer: "addressrules.xyz/signer"
    }) as { sub: string, parent_id: string, ver: number };

    if (WEB_TOKEN_CONFIG.baseClaim.ver !== payload.ver) {
        return null
    }

    if (!await isValidRT(payload.sub, payload.parent_id)) {
        return null
    }

    return payload;
}

export async function isValidRT(accountId: string, jti: string) {
    const addedAt = await redis.zScore(`user_sessions:${accountId}`, jti);
    if (addedAt === null || addedAt <= Date.now()) {
        await redis.zRem(`user_sessions:${accountId}`, jti);
        return false;
    }

    return true;
}
