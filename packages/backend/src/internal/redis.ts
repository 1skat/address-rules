import { createClient } from "redis"
import { cfg } from "@/config.js"

const redis = createClient({ url: cfg.redis })
redis.on("error", (err) => {
    console.error("Redis error:", err)
});

await redis.connect()
export default redis;
