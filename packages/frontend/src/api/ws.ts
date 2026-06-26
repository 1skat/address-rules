import type { Base64EncodedWireTransaction } from "@solana/kit";
import { useSocketStore } from "../store/useSocketStore";

type SocketRequestMsg = {
    op: 1 | 8 | 4 | 6;
    id: string;
    route: string;
    payload?: any;
}

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
        error?: {
            code: string,
            message?: string
        }
    } | {
        op: 7,
        id: string,
        status: 500,
        error: Error
    }

type WsType = {
    socket: WebSocket | null;
    isAuthed: boolean;
    send: (msg: SocketRequestMsg) => boolean;
}

type PendingRequest = {
    isPending: boolean;
    sendCallback: () => void;
    resolve: (data: any) => void;
    reject: (err: Error) => void;
}

const wsClient: WsType = {
    socket: null,
    isAuthed: false,
    send(msg: SocketRequestMsg): boolean {
        console.log("Socket state:", this.socket?.readyState)
        if (!this.socket) {
            return false;
        }
        if (msg.op === 1) {
            this.socket.send(JSON.stringify(msg));
        }
        if (!this.isAuthed) return false;

        this.socket.send(JSON.stringify(msg));
        return true;
    }
}
const pendingRequests = new Map<string, PendingRequest>();
const activeSubscriptions = new Map<string, (msg: any) => void>();

export const connectWs = (token: string) => {
    if (wsClient.socket && wsClient.socket.readyState !== WebSocket.OPEN) return;

    wsClient.socket = new WebSocket("ws://localhost:3000");
    useSocketStore.getState().setStatus("connecting");

    wsClient.socket.onopen = () => {
        wsClient.send({
            op: 1,
            id: crypto.randomUUID(),
            route: "/auth",
            payload: { token }
        })
    }

    wsClient.socket.onmessage = (ev) => {
        const msg: SocketResponseMsg = JSON.parse(ev.data);

        switch (msg.op) {
            case 2:
                wsClient.isAuthed = true
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
            case 5: {
                if (msg.status === 200) {
                    const msgHandler = activeSubscriptions.get(msg.id); // callback msg handler
                    if (msgHandler) msgHandler(msg.data);
                } else {
                    activeSubscriptions.delete(msg.id);
                }
                break;
            }
            case 7:
                // todo: add an error handler to each msg to update state?
                console.log("ERROR", msg.error)
                activeSubscriptions.delete(msg.id)
                break;
        }
    }
}

const sendWsMessage = (route: string, payload: object) => {
    const id = crypto.randomUUID();

    const sendNow = () => {
        const pendingReq = pendingRequests.get(id)
        if (!pendingReq) return;

        const sent = wsClient.send({
            op: 8,
            id,
            route,
            payload,
        })
        if (sent) pendingReq.isPending = false;
    }

    const promise = new Promise((resolve, reject) => {
        pendingRequests.set(id, {
            isPending: true,
            sendCallback: sendNow,
            resolve,
            reject,
        })
    })

    if (wsClient.socket && wsClient.isAuthed) sendNow();

    return promise;
}

export const sendSolanaTransaction = async (signedTx: Base64EncodedWireTransaction) =>
    sendWsMessage("/transactions/send", { signedTx });

export const subscribeOrderStatus = async (orderId: string) => {
    const subId = crypto.randomUUID();
    const route = "/orders/subscribe-status";

    const unsubscribe = () => {
        activeSubscriptions.delete(subId);
        wsClient.send({
            op: 6,
            id: subId,
            route,
        });
    }
    const handleMsg = (msg: any) => {
        switch (msg) {
            case "EXECUTING": {
                console.log("tx executing")
                break; // still processing todo: set zustand states here
            }
            case "FILLED": {
                console.log("tx filled!")
                unsubscribe();
                break;
            }
            case "EXECUTION_FAILED": {
                console.log("tx failed");
                break;
            }
        }
    }

    activeSubscriptions.set(subId, handleMsg); // save callback for the 5-opcode

    wsClient.send({
        op: 4,
        id: subId,
        route,
        payload: { orderId },
    });
}
