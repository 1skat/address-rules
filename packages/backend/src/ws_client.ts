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
        status: 400 | 401
        err?: {
            code: string,
            message?: string
        }
    } | {
        op: 7,
        id: string,
        status: 500,
        err?: {
            code: string,
            message?: string
        }
    }

const conns = new Map<string, Set<WebSocket>>();
const subscriptions = new Map<string, Map<string, object>>(); // Map<userId,Map<subId, topic>> where topic e.g orderId 

const pub = (userId: string, data: SocketResponseMsg) => {
    const socks = conns.get(userId);
    if (!socks) return;

    for (const ws of socks) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data))
        }
    }
}

export const subsClient = {
    sub: (userId: string, subId: string, topic: string) => {
        if (!subscriptions.has(userId)) subscriptions.set(userId, new Map());

        subscriptions.get(userId)?.set(subId, { topic });
    },
    push: (userId: string, topic: string, topicData: any) => {
        const userSubs = subscriptions.get(userId);
        if (!userSubs) {
            console.log(`push - userId: ${userId} not found, returning`)
            return;
        }

        for (const [subId, sub] of userSubs) {
            if (topic === sub.topic) {
                pub(userId, {
                    op: 5,
                    id: subId,
                    status: 200,
                    data: topicData,
                })
            }
        }
    },
    pushErrAndDrop: (userId: string, topic: string, err: any) => {
        const userSubs = subscriptions.get(userId);
        if (!userSubs) {
            console.log(`pushErr - userId: ${userId} not found, returning`)
            return;
        }

        for (const [subId, sub] of userSubs) {
            if (topic === sub.topic) {
                pub(userId, {
                    op: 7,
                    id: subId,
                    status: 500,
                    err,
                })
            }
            userSubs.delete(subId)
        }
        if (userSubs.size === 0) subscriptions.delete(userId);
    },
    unsub: (userId: string, subId: string) => {
        const userSubs = subscriptions.get(userId);
        if (!userSubs) return;

        userSubs.delete(subId);
        if (userSubs.size === 0) subscriptions.delete(userId);
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
    pub,
}

export type WsClient = typeof wsClient;
export type SubsClient = typeof subsClient;
