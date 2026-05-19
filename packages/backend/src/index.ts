import 'dotenv/config'
import { randomBytes, randomUUID } from "crypto";
import express from "express"
import { PublicKey } from "@solana/web3.js";
import { LRUCache } from "lru-cache";
import { tryCatch } from "@/utils/try-catch.js";
import sql from "@/internal/db.js"
import redis from "@/internal/redis.js"
import jwt from "jsonwebtoken"
import cors from "cors"
import { verifySignIn } from '@solana/wallet-standard-util';
import { cfg } from "@/config.js"
import { authenticate, isValidRT } from './middleware/authenticate.js';
import { access } from 'fs';

const WEB_TOKEN_CONFIG = {
    accessExpMs: 30 * 60 * 1000,
    accessExpStr: "30m",
    refreshExpMs: 7 * 24 * 60 * 60 * 1000,
    refreshExpSec: 7 * 24 * 60 * 60,
    refreshExpStr: "7d",
};

const app = express()
app.use(express.json());
app.disable("x-powered-by");
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

const nonceCache = new LRUCache<string, string>({
    max: 100,
    ttl: 5 * 60_000,
});
const sessionCache = new LRUCache<string, Object>({
    max: 100,
    ttl: 2 * 60_000,
});

app.post("/account/logout", authenticate, async (req, res) => {
    await redis.del(`validRT:${req.user.parent_id}`)
    res.clearCookie("refreshToken", { path: "/account" });

    return res.status(200).json("");
});

app.post("/account/refresh-access-token", async (req, res) => {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken) {
        return res.status(401).json("");
    }

    // clean up expiered tokens from zset
    // const expirationTime = Date.now() - REFRESH_TOKEN_CONFIG.expMs;
    // await redis.zRemRangeByScore(`user_sessions:${req.user.sub}`, 0, expirationTime);

    const payload = jwt.verify(oldRefreshToken, cfg.jwt.pubKey, { algorithms: ["ES256"] }) as { sub: string, jti: string };
    if (!isValidRT(payload.sub, payload.jti)) {
        return res.status(401).json("");
    }

    const newRtJTI = randomUUID();
    const accessToken = jwt.sign(
        { sub: payload.sub, aud: "addressrules.xyz/access", father_id: newRtJTI, iss: "addressrules.xyz/signer" },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.accessExpStr }
    );
    const newRefreshToken = jwt.sign(
        { sub: payload.sub, aud: "addressrules.xyz/refresh", jti: newRtJTI, iss: "addressrules.xyz/signer" },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.refreshExpStr }
    );

    await redis.zAdd(`user_sessions:${payload.sub}`, { score: Date.now(), value: newRtJTI });
    await redis.zRemRangeByRank(`user_sessions:${payload.sub}`, 0, -5) // limit to 4 concurrent sessions per user

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60_000, // 7 days
        path: "/account"
    });
    return res.status(200).json({ accessToken });
});

app.post("/account/login-by-wallet/init", async (req, res) => {
    const { address, walletType, chain } = req.body; // zod

    const [_, invalid] = tryCatch(() => new PublicKey(address));
    if (invalid) {
        return res.status(400).json("invalid")
    };

    const existing = nonceCache.get(`nonce:${address}`);
    const nonce = existing ?? randomBytes(4).toString("hex");
    if (!existing) {
        nonceCache.set(`nonce:${address}`, nonce);
    };
    const sessionId = randomUUID();
    sessionCache.set(`session:${sessionId}`, { nonce, address }); // create a session tied to the nonce

    return res.status(200).json({
        nonce,
        sessionId,
    });
});

// i need a rate limiter
app.post("/account/login-by-wallet/verify", async (req, res) => {
    const { sessionId, walletType, address, input, output } = req.body; // input is message created on the frontend
    const userSession = sessionCache.get(`session:${sessionId}`);
    if (!userSession) return res.status(401).json("");

    const backendOutput = {
        account: {
            ...output.account,
            publicKey: new Uint8Array(output.account.publicKey)
        },
        signature: new Uint8Array(Object.values(output.signature)),
        signedMessage: new Uint8Array(Object.values(output.signedMessage))
    }
    if (!verifySignIn(input, backendOutput)) {
        return res.status(401).json("does not match")
    }

    sessionCache.delete(`session:${sessionId}`);

    const [account] = await sql`
    WITH inserted AS (
        INSERT INTO accounts (vendor, indentifier, salt)
        VALUES (${walletType}, ${address}, ${randomBytes(32).toString("hex")})
        ON CONFLICT (vendor, indentifier) DO NOTHING
        RETURNING id
    )
    SELECT * FROM inserted
    UNION ALL
    SELECT id FROM accounts 
    WHERE vendor = ${walletType} AND indentifier = ${address}
    AND NOT EXISTS (SELECT 1 FROM inserted)
    `;

    if (!account) return res.status(400).json("db failed");

    const rtJTI = randomUUID(); // refresh token JTI 
    // console.log(cfg.jwt)
    // return
    const refreshToken = jwt.sign(
        { sub: account.id, aud: "addressrules.xyz/refresh", jti: rtJTI, iss: "addressrules.xyz/signer" },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: REFRESH_TOKEN_CONFIG.expDays }
    );
    const accessToken = jwt.sign(
        { sub: account.id, aud: "addressrules.xyz/access", parent_id: rtJTI, iss: "addressrules.xyz/signer" },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: "30m" }
    );

    await redis.zAdd(`user_sessions:${account.id}`, { score: Date.now(), value: rtJTI })
    await redis.zRemRangeByRank(`user_sessions:${account.id}`, 0, -5) // limit to 4 concurrent sessions per user

    // dont store refresh tokens in postgress anymore
    // await sql`
    // WITH _ AS (
    //     INSERT INTO refresh_tokens (id, account_id, expires_at)
    //     VALUES (${rtJTI}, ${account.id}, now() + interval '7 days' )
    // )
    // DELETE FROM refresh_tokes
    // WHERE account_id = ${account.id}
    // AND id NOT IN (
    // SELECT id FROM refresh_tokens
    // WHERE account_id = ${account.id}
    // ORDER BY created_at DESC 
    // LIMIT 3
    // )`;

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60_000, // 7 days
        path: "/account"
    });

    return res.status(200).json({ accessToken });
});

app.get("user-info", authenticate, async (req, res) => {

})

app.listen(3000);
console.log("Express server is running on port 3000")
