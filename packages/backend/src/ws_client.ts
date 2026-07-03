import type WebSocket from "ws";

type SocketError = {
    code: string;
    message?: string;
}
type SocketResponseMsg =
    | {
        op: 2 | 9 | 5;
        id: string;
        status: 200;
        data?: any;
    }
    | {
        op: 2 | 9 | 5;
        id: string;
        status: 400 | 401;
        error?: SocketError;
    } | {
        op: 7;
        id: string;
        status: 500;
        error?: SocketError;
    }

const conns = new Map<string, Set<WebSocket>>();
// const subscriptions = new Map<string, Map<string, { topic: string }>>(); // Map<userId,Map<subId, topic>> where topic e.g orderId 
const subscriptions = new Map<WebSocket, Map<string, string>>(); // subs[ws] = Map<subId,topic>

const pub = (userId: string, data: SocketResponseMsg) => {
    const socks = conns.get(userId);
    if (!socks) return;

    for (const ws of socks) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(data))
        }
    }
}

// conns[userId] = Set(ws,ws,ws,ws,...) -> subs[ws] = Map<"wallet_update", Set(subid-1, subid-2,subid-3)>
// ws subed to /wallets/subscribe-updates:subId-1, /blockhash:sub-2, /server-time:sub-3
// on ws close (of 5 tabs open = 5 ws) we close the 2nd tab (2nd ws), wsClient.unsub(userId, ws) -> conns[userId].delete(ws) "deletes the 2nd socket of the 5", 
// subClient.delete(ws "2ns socket") -> deletes all of the subIds in it 

export const subsClient = {
    sub: (ws: WebSocket, subId: string, topic: string) => {
        if (!subscriptions.has(ws)) subscriptions.set(ws, new Map());
        subscriptions.get(ws)?.set(subId, topic);
    },
    // sub: (userId: string, subId: string, topic: string) => {
    //     if (!subscriptions.has(userId)) subscriptions.set(userId, new Map());

    //     subscriptions.get(userId)?.set(subId, { topic });
    // },
    push: (userId: string, topic: string, topicData: any) => {
        const userConns = conns.get(userId);
        if (!userConns) return;

        for (const conn of userConns) {
            const userSubs = subscriptions.get(conn)
            if (!userSubs) continue;

            for (const [subId, subTopic] of userSubs) {
                if (topic === subTopic) {
                    pub(userId, { op: 5, id: subId, status: 200, data: topicData, });
                }
            }
        }
    },
    // push: (userId: string, topic: string, topicData: any) => {
    //     const userSubs = subscriptions.get(userId);
    //     if (!userSubs) {
    //         console.log(`push - userId: ${userId} not found, returning`);
    //         return;
    //     }

    //     for (const [subId, sub] of userSubs) {
    //         if (topic === sub.topic) {
    //             pub(userId, {
    //                 op: 5,
    //                 id: subId,
    //                 status: 200,
    //                 data: topicData,
    //             })
    //         }
    //     }
    // },
    pushErrAndDrop: (userId: string, topic: string, error: SocketError) => {
        const userConns = conns.get(userId);
        if (!userConns) {
            console.log(`push - Ws for userId: ${userId} not found, returning`);
            return;
        }

        for (const conn of userConns) {
            const userSubs = subscriptions.get(conn)
            if (!userSubs) continue; // ws - 1 has, ws - 2 has, ws - 3 no

            for (const [subId, subTopic] of userSubs) {
                if (topic === subTopic) {
                    pub(userId, { op: 7, id: subId, status: 500, error, });

                    userSubs.delete(subId)
                }
            }
        }
    },
    // pushErrAndDrop: (userId: string, topic: string, error: SocketError) => {
    //     const userSubs = subscriptions.get(userId);
    //     if (!userSubs) {
    //         console.log(`pushErr - userId: ${userId} not found, returning`)
    //         return;
    //     }

    //     for (const [subId, sub] of userSubs) {
    //         if (topic === sub.topic) {
    //             pub(userId, {
    //                 op: 7,
    //                 id: subId,
    //                 status: 500,
    //                 error,
    //             })
    //         }
    //         userSubs.delete(subId)
    //     }
    //     if (userSubs.size === 0) subscriptions.delete(userId);
    // },
    // unsub: (userId: string, subId: string) => {
    //     const userSubs = subscriptions.get(userId);
    //     if (!userSubs) return;

    //     userSubs.delete(subId);
    //     if (userSubs.size === 0) subscriptions.delete(userId);
    // },
    unsub: (ws: WebSocket, subId: string) => subscriptions.get(ws)?.delete(subId),
    clear: (ws: WebSocket) => subscriptions.delete(ws), // drop only one of tab (ws) of multiple
}

export const wsClient = {
    sub: (userId: string, ws: WebSocket) => {
        if (!conns.has(userId)) conns.set(userId, new Set());
        conns.get(userId)?.add(ws);
    },
    unsub: (userId: string, ws: WebSocket) => {
        const uws = conns.get(userId);
        if (!uws) return;
        uws.delete(ws);
        if (uws.size === 0) conns.delete(userId);
    },
    pub,
}

export type WsClient = typeof wsClient;
export type SubsClient = typeof subsClient;
