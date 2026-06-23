import type { Server } from "http";
import { WebSocketServer } from 'ws';
import type { Db } from "./internal/db.js";
import { verifyAuthToken } from "./middleware/authenticate.js";
import { getSignatureFromTransaction } from "@solana/kit";
import { tryCatchAsync } from "./utils/try-catch.js";
import { sendAndConfirmSolanaTransaction } from "./internal/rpc.js";
import { wsClient, type WsClient } from "./ws_client.js";
import sql from "./internal/db.js";

// type SocketResponseMsg =
//     | {
//         id: string,
//         status: 200
//         data?: any
//     }
//     | {
//         id: string,
//         status: 400 | 401 | 500
//         error: {
//             code: string,
//             message?: string
//         }
//     }

type Context = {
    db: Db;
    userId: string | null;
    wsClient: WsClient;
}

type SocketRequestMsg = {
    id: string,
    route: string,
    payload: any
}

type HandlerType = (ctx: Context, id: string, data: any) => Promise<void>;

const sendTransaction = async (ctx: Context, id: string, data: any) => {
    const { signedTx } = data;

    if (!signedTx) {
        return ctx.wsClient.pub(id, {
            id,
            status: 400,
            error: { code: "MISSING_TX", message: "Transaction required" }
        })
    }

    ctx.wsClient.pub(id, {
        id,
        status: 200,
        data: { txStatus: "pending" }
    })

    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

    if (txErr) {
        return ctx.wsClient.pub(id, {
            id,
            status: 400,
            error: { code: "TX_FAIL", message: "Transaction failed" }
        })
    }
    const signature = getSignatureFromTransaction(signedTx); // already finalized

    return ctx.wsClient.pub(id, {
        id,
        status: 200,
        data: { txStatus: "finalized", signature }
    })
}

const routes: Record<string, HandlerType> = {
    "/transactions/send": sendTransaction
}

const authenticateSocketConnection = async (authMsg: SocketRequestMsg) => {
    if (authMsg.route !== "/auth") throw new Error()

    const { token } = authMsg.payload;
    if (!token) throw new Error()

    const payload = await verifyAuthToken(token)
    if (!payload) throw new Error();

    return payload;
}

export function initWs(server: Server) {
    const wss = new WebSocketServer({ server })

    wss.on("connection", async (ws, req) => {
        let ctx: Context = {
            db: sql,
            userId: null,
            wsClient,
        }

        const authTimeout = setTimeout(() => {
            if (!ctx.userId) ws.close(4001, "Timeout")
        }, 6000);

        ws.on("message", async (raw) => {
            const msg: SocketRequestMsg = JSON.parse(raw.toString()) // use zod
            console.log("RECEIVED:", msg)

            if (!ctx.userId) {
                try {
                    const payload = await authenticateSocketConnection(msg)

                    ctx.userId = payload.sub;
                    ctx.wsClient.sub(payload.sub, ws)
                    ws.send(JSON.stringify({
                        id: msg.id,
                        status: 200,
                    }))
                    clearTimeout(authTimeout)
                    return;
                } catch {
                    ws.send(JSON.stringify({
                        id: msg.id,
                        status: 401,
                        error: {
                            code: "UNAUTHENTICATED"
                        }
                    }))
                    ws.close(4001, "Unauthorized")
                    return;
                }
            }

            const handler = routes[msg.route]

            if (!handler) {
                ws.send(JSON.stringify({
                    id: msg.id,
                    status: 500,
                }));
                return;
            }

            await handler(ctx, msg.id, msg.payload)
        });
        ws.on("error", (err) => {
            console.error(err)
        })
        ws.on("close", () => {
            ctx.userId && ctx.wsClient.unsub(ctx.userId, ws);
            clearTimeout(authTimeout)
        })
    })
}

