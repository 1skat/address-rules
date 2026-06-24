import type WebSocket from "ws";

const conns = new Map<string, Set<WebSocket>>(); // one user, multiple conns
const subsriptions = new Map<any, any>();
// order statuses

type SocketResponseMsg =
    | {
        op: 2 | 9
        id: string,
        status: 200
        data?: any
    }
    | {
        op: 2 | 9
        id: string,
        status: 400 | 401 | 500
        error?: {
            code: string,
            message?: string
        }
    }

export const wsClient = {
    sub: (userId: string, ws: WebSocket) => {
        if (!conns.has(userId)) conns.set(userId, new Set());
        conns.get(userId)?.add(ws)
    },
    unsub: (userId: string, ws: WebSocket) => {
        const uws = conns.get(userId);
        if (!uws) return;
        uws.delete(ws)
        if (uws.size === 0) conns.delete(userId);
    },
    pub: (userId: string, data: SocketResponseMsg) => {
        const socks = conns.get(userId);
        if (!socks) return;

        for (const ws of socks) {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(data))
            }
        }
    }
}

export const subsClient = {
    sub: (subId: string, orderId: string) => {
        subsriptions.set(subId, { orderId })
        // const curr = 
    }

}

export type WsClient = typeof wsClient;
