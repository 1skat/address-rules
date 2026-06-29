import type { Server } from "http";
import { WebSocketServer } from 'ws';
import type { Db } from "./internal/db.js";
import { verifyAuthToken } from "./middleware/authenticate.js";
import sql from "./internal/db.js";
import { sendTransaction, subscribeOrderStatus } from "./socket/transactions.js";
import type { SubsClient, WsClient } from "./ws_client.js";
import { wsClient, subsClient } from "./ws_client.js";
import { subscribeUserWallets } from "./socket/user_wallets.js";

export type Context = {
    db: Db;
    userId: string;
    wsClient: WsClient;
    subsClient: SubsClient;
}

type SocketRequestMsg = {
    op: 1 | 8 | 4 | 6;
    id: string;
    route: string;
    payload: any;
}

type HandlerType = (ctx: Context, id: string, data?: any) => void;

const routes: Record<string, HandlerType> = {
    "/transactions/send": sendTransaction
}

const subscriptionRoutes = {
    "/orders/subscribe-status": subscribeOrderStatus,
    "/wallets/subscribe-updates": subscribeUserWallets,
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
            subsClient,
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
                    ctx.wsClient.sub(payload.sub, ws)
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

            if (!ctx.userId) { // auth gate
                ws.send(JSON.stringify({ op: 9, id: msg.id, status: 401, error: { code: "UNAUTHENTICATED" } }));
                return;
            }

            switch (msg.op) {
                case 8: {
                    const handler = routes[msg.route];
                    if (!handler) {
                        return ws.send(JSON.stringify({
                            op: 9,
                            id: msg.id,
                            status: 500,
                        }));
                    }
                    return handler(ctx, msg.id, msg.payload);
                }
                case 4: {
                    const handler = subscriptionRoutes[msg.route];
                    if (!handler) {
                        return ws.send(JSON.stringify({
                            op: 5,
                            id: msg.id,
                            status: 500,
                        }));
                    }
                    return handler(ctx, msg.id, msg.payload);
                }
                case 6: {
                    return ctx.subsClient.unsub(ctx.userId, msg.id);
                }
            }
        });
        ws.on("error", (err) => {
            console.error(err)
        });
        ws.on("close", () => {
            ctx.userId && ctx.wsClient.unsub(ctx.userId, ws);
            clearTimeout(authTimeout)
        });
    })
}

