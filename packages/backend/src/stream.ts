import type { Server } from "http";
import WebSocket, { WebSocketServer } from 'ws';
import type { Db } from "./internal/db.js";
import sql from "./internal/db.js";
import { authenticate, verifyAuth } from "./middleware/authenticate.js";
import { getSignatureFromTransaction } from "@solana/kit";
import { tryCatchAsync } from "./utils/try-catch.js";
import { sendAndConfirmSolanaTransaction } from "./internal/rpc.js";

type SocketResponseMsg =
    | {
        id: string,
        status: 200
        data: any
    }
    | {
        id: string,
        status: 400 | 401 | 500
        error: {
            code: string,
            message?: string
        }
    }

type Context = {
    db: Db;
    userId: string;
    pub: (msg: SocketResponseMsg) => void;
}

type SocketRequestMsg = {
    id: string,
    payload: any,
}

const sendTransaction = async (ctx: Context, id: string, data: any) => {
    const { signedTx } = data;

    if (!signedTx) {
        return ctx.pub({
            id,
            status: 400,
            error: { code: "MISSING_TX", message: "Transaction required" }
        })
    }

    ctx.pub({
        id,
        status: 200,
        data: { txStatus: "pending" }
    })

    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

    if (txErr) {
        return ctx.pub({
            id: crypto.randomUUID(),
            status: 400,
            error: { code: "TX_FAIL", message: "Transaction failed" }
        })
    }
    const signature = getSignatureFromTransaction(signedTx); // already finalized

    return ctx.pub({
        id: crypto.randomUUID(),
        status: 200,
        data: { txStatus: "finalized", signature }
    })
}

const routes = {
    "/transactions/send": sendTransaction
}



export function initWs(server: Server) {
    const wss = new WebSocketServer({ server })

    wss.on("connection", async (ws, req) => {
        const header = req.headers.authorization;
        if (!header) {
            ws.send(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        const payload = await verifyAuth(header)
        if (!payload) {
            ws.send(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        const ctx: Context = {
            db: sql,
            userId: payload.sub,
            pub: (msg: SocketResponseMsg) => ws.send(JSON.stringify(msg)),
        }

        ws.on("message", async (raw) => {
            const msg = JSON.parse(raw.toString()) // use zod

            const handler = routes[msg.route]

            if (!handler) {
                ws.send(JSON.stringify({ error: 500 }));
                return;
            }

            await handler(ctx, msg.payload)
        })
        ws.on("error", (err) => {
            console.error(err)
        })
        ws.on("close", () => console.log("disconnected"))
    })

}

