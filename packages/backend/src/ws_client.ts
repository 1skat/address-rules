import type WebSocket from "ws";

const conns = new Map<string, Set<WebSocket>>(); // one user, multiple conns

type SocketResponseMsg =
    | {
        id: string,
        status: 200
        data?: any
    }
    | {
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

export type WsClient = typeof wsClient;
