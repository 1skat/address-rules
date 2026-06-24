import type WebSocket from "ws";

type SocketResponseMsg =
    | {
        op: 2 | 9 | 5
        id: string,
        status: 200
        data?: any
    }
    | {
        op: 2 | 9 | 5
        id: string,
        status: 400 | 401 | 500
        error?: {
            code: string,
            message?: string
        }
    }

// type OrderStatus = "EXECUTING" | "FILLED" | "EXECUTION_FAILED";
// const orderStatusStore = new Map<string, OrderStatus>();

const conns = new Map<string, Set<WebSocket>>();
const subscriptions = new Map<string, any>();

const pub = (userId: string, data: SocketResponseMsg) => {
    const socks = conns.get(userId);
    if (!socks) return;

    for (const ws of socks) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data))
        }
    }
}

export const wsClient = {
    regiter: (userId: string, ws: WebSocket) => {
        if (!conns.has(userId)) conns.set(userId, new Set());
        conns.get(userId)?.add(ws)
    },
    remove: (userId: string, ws: WebSocket) => {
        const uws = conns.get(userId);
        if (!uws) return;
        uws.delete(ws)
        if (uws.size === 0) conns.delete(userId);
    },
    pub,
    subcribe: (userId: string, subId: string, topic: string) => {
        subscriptions.set(subId, { topic, userId });
    },
    push: (topic: string, data: any) => {
        for (const [subId, sub] of subscriptions) {
            if (sub.topic == topic) pub(sub.userId, {
                op: 5,
                id: subId,
                status: 200,
                data
            })
        }
    }
}

export type WsClient = typeof wsClient;
