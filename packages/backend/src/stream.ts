import type { Server } from "http";
import { WebSocketServer } from 'ws';
import type { Db } from "./internal/db.js";
import { verifyAuthToken } from "./middleware/authenticate.js";
import { ackSubscribedOrderStatus, sendTransaction } from "./socket/transactions.js";
import type { SubsClient, WsClient } from "./ws_client.js";
import { subsClient, wsClient } from "./ws_client.js";
import { ackSubscribedUserWallets } from "./socket/user_wallets.js";

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

type HandlerType = (userId: string, id: string, data?: any) => void;

const routes: Record<string, HandlerType> = {
    "/transactions/send": sendTransaction
}

const subscriptionRoutes = {
    "/orders/subscribe-status": { handler: ackSubscribedOrderStatus, topic: "order_status" },
    "/wallets/subscribe-updates": { handler: ackSubscribedUserWallets, topic: "wallet_update" },
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
        let userId: string | null = null;

        const authTimeout = setTimeout(() => {
            if (userId) ws.close(4001, "Timeout")
        }, 6000);

        ws.on("message", async (raw) => {
            const msg: SocketRequestMsg = JSON.parse(raw.toString()) // use zod

            if (msg.op === 1) {
                try {
                    const payload = await authenticateSocketConnection(msg)
                    userId = payload.sub;

                    wsClient.sub(userId, ws); // conns[userId] = ws
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

            if (!userId) { // auth gate
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
                    return handler(userId, msg.id, msg.payload);
                }
                case 4: {
                    const subRoute = subscriptionRoutes[msg.route];
                    if (!subRoute) {
                        return ws.send(JSON.stringify({
                            op: 5,
                            id: msg.id,
                            status: 500,
                        }));
                    }
                    const { handler, topic } = subRoute;
                    subsClient.sub(ws, msg.id, topic) // subs<ws,<subId,topic>> 
                    return handler(userId, topic, msg.payload); // e.g payload orderId = "wJHrkHh..."
                }
                case 6: {
                    return subsClient.unsub(ws, msg.id);
                }
            }
        });
        ws.on("error", (err) => {
            console.error(err)
        });
        ws.on("close", () => {
            userId && wsClient.unsub(userId, ws);
            subsClient.clear(ws)
            clearTimeout(authTimeout)
        });
    })
}

