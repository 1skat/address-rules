import { randomBytes, randomUUID } from "crypto";
import express from "express"
import redis from "@/internal/redis.js"

const app = express();
app.use(express.json())

app.post("/sign-in", async (req, res) => {
    try {
        const { accountId } = req.body;

        const rtJTI = randomUUID(); // refresh token JTI 
        await redis.set(`user_sessions:${accountId}`, rtJTI, { "EX": 7 * 24 * 60 * 60 })
        await redis.zAdd(`user_sessions:${accountId}`, { score: Date.now(), value: rtJTI });
        await redis.zRemRangeByRank(`user_sessions:${accountId}`, 0, -5);

        const vals = await redis.zRange(`user_sessions:${accountId}`, 0, -1);
        return res.status(201).json(vals);
    } catch (err) {
        return res.status(401).json(err);
    }
});

app.listen(3002)
console.log("test server running on 3002");
