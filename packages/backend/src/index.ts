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
import cookieParser from "cookie-parser";
import txRouter from './transactions.js';
import http from 'http';
import { initWs } from './stream.js';

export const WEB_TOKEN_CONFIG = {
    accessExpMs: 30 * 60 * 1000,
    accessExpStr: "30m",
    refreshExpMs: 7 * 24 * 60 * 60 * 1000,
    refreshExpSec: 7 * 24 * 60 * 60,
    refreshExpStr: "7d",
    baseClaim: {
        iss: "addressrules.xyz/signer",
        ver: 1
    },
};

const app = express()
app.use(express.json());
app.use(cookieParser());
app.disable("x-powered-by");
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true,
}));

const nonceCache = new LRUCache<string, string>({
    max: 100,
    ttl: 5 * 60_000,
});
const sessionCache = new LRUCache<string, boolean>({
    max: 100,
    ttl: 2 * 60_000,
});


app.use("/transactions", txRouter)

app.post("/account/logout", authenticate, async (req, res) => {
    await redis.zRem(`user_sessions:${req.user.sub}`, req.user.parent_id);
    res.clearCookie("refreshToken", { path: "/account" });

    return res.status(200).send("OK");
});

app.post("/account/refresh-access-token", async (req, res) => {
    const oldRefreshToken = req.cookies.refreshToken;
    if (!oldRefreshToken) {
        return res.status(401).end();
    }

    const payload = jwt.verify(oldRefreshToken, cfg.jwt.pubKey, { algorithms: ["ES256"], audience: "addressrules.xyz/refresh", issuer: "addressrules.xyz/signer" }) as { sub: string, jti: string, ver: number };
    if (WEB_TOKEN_CONFIG.baseClaim.ver !== payload.ver) {
        return res.status(403).json("legacy version")
    }
    if (! await isValidRT(payload.sub, payload.jti)) {
        return res.status(401).json("blacklisted refresh token");
    }

    await redis.zRem(`user_sessions:${payload.sub}`, payload.jti);

    const newRtJTI = randomUUID();
    const accessToken = jwt.sign(
        { sub: payload.sub, aud: "addressrules.xyz/access", parent_id: newRtJTI, ...WEB_TOKEN_CONFIG.baseClaim },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.accessExpStr }
    );
    const newRefreshToken = jwt.sign(
        { sub: payload.sub, aud: "addressrules.xyz/refresh", jti: newRtJTI, ...WEB_TOKEN_CONFIG.baseClaim },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.refreshExpStr }
    );

    await redis.zAdd(`user_sessions:${payload.sub}`, { score: Date.now() + WEB_TOKEN_CONFIG.refreshExpMs /*expiery time*/, value: newRtJTI })
    await redis.zRemRangeByRank(`user_sessions:${payload.sub}`, 0, -5) // limit to 4 concurrent sessions per user

    res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: cfg.node_env === "production",
        sameSite: "strict",
        maxAge: WEB_TOKEN_CONFIG.refreshExpMs, // 7 days
        path: "/account"
    });
    return res.status(200).json({ accessToken });
});

app.post("/account/login-by-wallet/init", async (req, res) => {
    const { address, walletType, chain } = req.body; // zod

    const [_, invalid] = tryCatch(() => new PublicKey(address));
    if (invalid) {
        return res.status(400).json("invalid")
    }

    const existing = nonceCache.get(`nonce:${address}`);
    const nonce = existing ?? randomBytes(4).toString("hex");
    if (!existing) {
        nonceCache.set(`nonce:${address}`, nonce);
    };
    const sessionId = randomUUID();
    sessionCache.set(`session:${sessionId}`, true);

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
    nonceCache.delete(`nonce:${address}`);

    const [account] = await sql`
    WITH inserted AS (
        INSERT INTO accounts (provider, identifier, salt)
        VALUES (${walletType}, ${address}, ${randomBytes(32).toString("hex")})
        ON CONFLICT (provider, identifier) DO NOTHING
        RETURNING id
        )
        SELECT * FROM inserted
        UNION ALL
        SELECT id FROM accounts 
        WHERE provider = ${walletType} AND identifier = ${address}
        AND NOT EXISTS (SELECT 1 FROM inserted)
        `;

    if (!account) return res.status(400).json("db failed"); // remove in prod

    const rtJTI = randomUUID();
    const refreshToken = jwt.sign(
        { sub: account.id, aud: "addressrules.xyz/refresh", jti: rtJTI, iss: "addressrules.xyz/signer", ver: 1 },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.refreshExpStr }
    );
    const accessToken = jwt.sign(
        { sub: account.id, aud: "addressrules.xyz/access", parent_id: rtJTI, iss: "addressrules.xyz/signer", ver: 1 },
        cfg.jwt.privKey,
        { algorithm: "ES256", expiresIn: WEB_TOKEN_CONFIG.accessExpStr }
    );

    await redis.zAdd(`user_sessions:${account.id}`, { score: Date.now() + WEB_TOKEN_CONFIG.refreshExpMs /*expiery time*/, value: rtJTI })
    await redis.zRemRangeByRank(`user_sessions:${account.id}`, 0, -5) // limit to 4 concurrent sessions per user

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: cfg.node_env === "production",
        sameSite: cfg.node_env === "production" ? "strict" : "lax",
        maxAge: WEB_TOKEN_CONFIG.refreshExpMs, // 7 days
        path: "/account"
    });

    return res.status(200).json({ accessToken });
});

app.post("/wallets", authenticate, async (req, res) => {
    const { address, derivationIndex, alias, chainId, posX, posY } = req.body;
    try {
        const [wallet] = await sql`
            INSERT INTO wallets (account_id, address, derivation_index, alias, chain_id, position_x, position_y)
            VALUES (
            ${req.user.sub},
            ${address},
            ${derivationIndex},
            ${alias},
            ${chainId},
            ${posX},
            ${posY})
            RETURNING *
            `;

        return res.status(201).json(wallet);
    } catch (err) {
        if (err.code === "23505") return res.status(409).json(`address already exists: ${err}`);
        return res.status(500).json(err.message)
    }
});

app.get("/wallets/next-index", authenticate, async (req, res) => {
    const { chainId } = req.query; // zod
    if (!chainId) {
        return res.status(401).json("chain required")
    }
    const [{ max }] = await sql`SELECT MAX(derivation_index) as max FROM wallets WHERE account_id = ${req.user.sub} AND chain_id = ${chainId} `;

    return res.status(200).json({ nextIndex: max === null ? 0 : max + 1 });
})

app.post("/wallets/archive", authenticate, async (req, res) => {
    try {
        const { walletId } = req.body;
        if (!walletId) {
            return res.status(400).json({ error: "cannot find wallet" });
        }
        await sql`UPDATE wallets SET archived = true WHERE id = ${walletId}`;

        return res.status(200).end();
    } catch {
        return res.status(401).end();
    }
})

app.use((err, req, res, next) => {

    res.status(500).json({
        error: "Internal error: " + err.message // remove the err in prod
    })
});


const server = http.createServer(app);

initWs(server)
server.listen(3000);
// app.listen(3000);
console.log("Express server is running on port 3000")


