import type { Base64EncodedWireTransaction } from "@solana/kit";
import { useSocketStore } from "../store/useSocketStore";

type SocketRequestMsg = {
    op: 1 | 8 | 4;
    id: string;
    route: string;
    payload: any;
}

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

type PendingRequest = {
    isPending: boolean;
    sendCallback: () => void;
    resolve: (data: any) => void;
    reject: (err: Error) => void;
}

type OrderStatus = "EXECUTING" | "FILLED" | "EXECUTION_FAILED";

let socket: WebSocket | null = null;
let isAuthed: boolean = false;
const pendingRequests = new Map<string, PendingRequest>();
const activeSubscriptions = new Map<string, any>();

export const connectWs = (token: string) => {
    if (socket && socket.readyState !== WebSocket.OPEN) return;

    socket = new WebSocket("ws://localhost:3000");
    useSocketStore.getState().setStatus("connecting");

    socket.onopen = () => {
        socket.send(JSON.stringify({
            op: 1,
            id: crypto.randomUUID(),
            route: "/auth",
            payload: { token }
        }))
    }

    socket.onmessage = (ev) => {
        const msg: SocketResponseMsg = JSON.parse(ev.data);

        switch (msg.op) {
            case 2:
                isAuthed = true
                pendingRequests.forEach((req, id) => { // replaying all the requests queued up before auth
                    if (req.isPending) {
                        req.sendCallback();
                        req.isPending = false;
                    }
                });
                break;
            case 9: {
                const pendingReq = pendingRequests.get(msg.id)
                if (!pendingReq) return;

                pendingRequests.delete(msg.id);

                if (msg.status === 200) {
                    pendingReq.resolve(msg.data); // e.g orderId from /transactions/send
                } else {
                    pendingReq.reject(new Error(`Failed: ${msg.status}`));
                }
                break;
            }
        }
    }
}

const sendWsMessage = (route: string, payload: object) => {
    const id = crypto.randomUUID();

    const sendNow = () => {
        if (!socket || !isAuthed) {
            throw new Error("WebSocket not ready");
        }
        const pendingReq = pendingRequests.get(id)
        if (!pendingReq) return;

        const msg: SocketRequestMsg = {
            op: 8,
            id,
            route,
            payload,
        }

        socket.send(JSON.stringify(msg))
        pendingReq.isPending = false;
    }

    const promise = new Promise((resolve, reject) => {
        pendingRequests.set(id, {
            isPending: true,
            sendCallback: sendNow,
            resolve,
            reject,
        })
    })

    if (socket && isAuthed) sendNow();

    return promise;
}

export const sendSolanaTransaction = async (signedTx: Base64EncodedWireTransaction) =>
    sendWsMessage("/transactions/send", { signedTx });

export const subscribeOrderStatus = async (orderId: string) => {
    if (!socket || !isAuthed) {
        throw new Error("WebSocket not ready");
    }
    const op = 4;
    const subId = crypto.randomUUID();
    activeSubscriptions.set(subId, {
        onMessage: () => {
            switch ()
    }
        })

    const msg: SocketRequestMsg = {
        op, // 4
        id: subId,
        route: "/orders/subscribe-status",
        payload: { orderId }
    }

    socket.send(JSON.stringify(msg));
}
