import type { Server } from "http";
import { WebSocketServer } from 'ws';
import type { Db } from "./internal/db.js";
import { verifyAuthToken } from "./middleware/authenticate.js";
import { getSignatureFromTransaction } from "@solana/kit";
import { tryCatchAsync } from "./utils/try-catch.js";
import { sendAndConfirmSolanaTransaction } from "./internal/rpc.js";
import { orderStatusStore, wsClient, type WsClient } from "./ws_client.js";
import sql from "./internal/db.js";
import { randomUUID } from "crypto";
import { sendTransaction, subscribeOrderStatus } from "./stream/transactions.js";

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

export type Context = {
    db: Db;
    userId: string;
    wsClient: WsClient;
    subsriptions: Map<any, any>;
}

type SocketRequestMsg = {
    op: 1 | 8 | 4 | 6;
    id: string;
    route: string;
    payload: any;
}

type HandlerType = (ctx: Context, id: string, data: any) => void;

// const sendTransaction = (ctx: Context, id: string, data: any) => {
//     const { signedTx } = data;
//     const op = 9;

//     if (!signedTx) {
//         return ctx.wsClient.pub(ctx.userId, {
//             op,
//             id,
//             status: 400,
//             error: { code: "MISSING_TX", message: "Transaction required" }
//         });
//     }

//     const orderId = randomUUID();
//     processTx(ctx, orderId, signedTx);

//     // orderStatusStore.set(orderId, "EXECUTING");

//     return ctx.wsClient.pub(ctx.userId, {
//         op,
//         id,
//         status: 200,
//         data: { orderId }
//     });

// const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

// if (txErr) {
//     return ctx.wsClient.pub(ctx.userId, {
//         op,
//         id,
//         status: 400,
//         error: { code: "TX_FAIL", message: "Transaction failed" }
//     })
// }
// const signature = getSignatureFromTransaction(signedTx); // already finalized

// return ctx.wsClient.pub(ctx.userId, {
//     op,
//     id,
//     status: 200,
//     data: { txStatus: "finalized", signature }
// })
// }

// const processTx = async (ctx: Context, orderId: string, signedTx: any) => {
//     const op = 5;
//     const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

//     if (txErr) {

//         // no ws send just set and push
//     }
// }



// const subscribeOrderStatus = async (ctx: Context, subId: string, payload: any) => {
//     const op = 5;
//     const { orderId } = payload;
//     if (!orderId) return;

//     ctx.wsClient.subcribe(ctx.userId, subId, orderId)

// }

const routes: Record<string, HandlerType> = {
    "/transactions/send": sendTransaction
}

const subscriptionRoutes = {
    "/orders/subscribe-status": subscribeOrderStatus
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
            subsriptions: new Map(),
        }

        const authTimeout = setTimeout(() => {
            if (!ctx.userId) ws.close(4001, "Timeout")
        }, 6000);

        ws.on("message", async (raw) => {
            const msg: SocketRequestMsg = JSON.parse(raw.toString()) // use zod

            if (msg.op === 1) {
                try {
                    const payload = await authenticateSocketConnection(msg)

                    ctx.userId = payload.sub;
                    ctx.wsClient.regiter(payload.sub, ws)
                    ws.send(JSON.stringify({
                        op: 2,
                        id: msg.id,
                        status: 200,
                    }))
                    clearTimeout(authTimeout)
                    return;
                } catch {
                    ws.send(JSON.stringify({
                        op: 2,
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

            if (!ctx.userId) {
                ws.send(JSON.stringify({ op: 9, id: msg.id, status: 401, error: { code: "UNAUTHENTICATED" } }));
                return;
            }

            switch (msg.op) {
                case 8: {
                    const handler = routes[msg.route]
                    if (!handler) {
                        ws.send(JSON.stringify({
                            op: 9,
                            id: msg.id,
                            status: 500,
                        }));
                        return;
                    }
                    await handler(ctx, msg.id, msg.payload)
                    return;
                }
                case 4: {
                    const handler = subscriptionRoutes[msg.route];
                    if (!handler) {
                        ws.send(JSON.stringify({
                            op: 5,
                            id: msg.id,
                            status: 500,
                        }));
                        return;
                    }
                    await handler(ctx, msg.id, msg.payload)
                }
            }

        });
        ws.on("error", (err) => {
            console.error(err)
        });
        ws.on("close", () => {
            ctx.userId && ctx.wsClient.remove(ctx.userId, ws);
            clearTimeout(authTimeout)
        });
    })
}

