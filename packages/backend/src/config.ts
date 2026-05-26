export const cfg = {
    jwt: {
        privKey: process.env.JWT_PRIVATE_KEY!,
        pubKey: process.env.JWT_PUBLIC_KEY!
    },
    db: process.env.DATABASE_URL!,
    redis: process.env.REDIS_URL!,
    node_env: process.env.NODE_ENV!,
} as const;




