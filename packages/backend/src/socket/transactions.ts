import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import { tryCatchAsync } from "@/utils/try-catch.js";
import { subsClient, wsClient } from "@/ws_client.js";
import { getBase64Encoder, getTransactionDecoder, type Blockhash, assertIsFullySignedTransaction, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED, isSolanaError, getCompiledTransactionMessageDecoder, decompileTransactionMessage } from "@solana/kit";
import {
    identifyTokenInstruction,
    parseTransferInstruction,
} from "@solana-program/token";

const TERMINAL_TTL_MS = 2 * 60 * 1000;
type SignedTx = {
    wireTx: string,
    blockhash: Blockhash,
    lastValidBlockHeight: string,
}
type OrderStatus =
    | { ok: true; status: "EXECUTING" | "FILLED" | "EXECUTION_FAILED" }
    | { ok: false; err: { code: string; message?: string } }

const orderStatusStore = {
    store: new Map<string, OrderStatus>(),
    timers: new Map<string, NodeJS.Timeout>(),

    scheduleCleanup(orderId: string) {
        if (this.timers.has(orderId)) this.timers.delete(orderId);

        const timer = setTimeout(() => {
            this.store.delete(orderId)
            this.timers.delete(orderId);
        }, TERMINAL_TTL_MS);

        this.timers.set(orderId, timer);
    },
    set(orderId: string, status: OrderStatus) {
        this.store.set(orderId, status);

        if (!status.ok || status.status !== "EXECUTING") this.scheduleCleanup(orderId);
    },
    get(orderId: string) {
        return this.store.get(orderId);
    }
}

// helpers
const setAndPushOrderStatus = (userId: string, orderId: string, status: OrderStatus): void => {
    orderStatusStore.set(orderId, status);
    // if (!status.ok) return subsClient.pushErrAndDrop(userId, orderId, status.err);
    // return subsClient.push(userId, orderId, status.status);
    if (!status.ok) return subsClient.pushErrAndDrop(userId, "order_status", status.err);
    return subsClient.push(userId, "order_status", status.status);
}

export const sendTransaction = (userId: string, id: string, data: any) => {
    const { signedTx } = data;
    const op = 9;

    if (!signedTx) {
        return wsClient.pub(userId, {
            op,
            id,
            status: 400,
            error: { code: "MISSING_TX", message: "Transaction required" }
        });
    }

    const orderId = crypto.randomUUID();
    setAndPushOrderStatus(userId, orderId, { ok: true, status: "EXECUTING" });
    processTx(userId, orderId, signedTx);

    return wsClient.pub(userId, {
        op,
        id,
        status: 200,
        data: { orderId },
    });
}

export const processTx = async (userId: string, orderId: string, signedTx: SignedTx) => {
    // zod
    const wireTxBytes = getBase64Encoder().encode(signedTx.wireTx);
    const decodedWireTx = getTransactionDecoder().decode(wireTxBytes);
    const fullTx = {
        ...decodedWireTx,
        lifetimeConstraint: {
            blockhash: signedTx.blockhash,
            lastValidBlockHeight: BigInt(signedTx.lastValidBlockHeight),
        }
    }
    assertIsFullySignedTransaction(fullTx);

    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(fullTx, { commitment: "confirmed" }));

    if (txErr) {
        const errCode = isSolanaError(txErr, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED) ? "BLOCKHASH_EXPIRED" : "TX_FAILED";
        return setAndPushOrderStatus(userId, orderId, { ok: false, err: { code: errCode } });
    }

    // todo: exract the value amount and send it over
    const compiled = getCompiledTransactionMessageDecoder().decode(decodedWireTx.messageBytes);
    const message = decompileTransactionMessage(compiled);

    const transferIx = message.instructions.find(ix => {
        console.log("ix", ix)
        const t = identifyTokenInstruction(ix)
        return t === 3 || t === 12;
    })
    if (!transferIx) {
        console.log("missing", transferIx)
        return;
    }

    const parsedIx = parseTransferInstruction(transferIx);
    console.log("parsed tx", parsedIx);

    return setAndPushOrderStatus(userId, orderId, { ok: true, status: "FILLED" });
}

// export const subscribeOrderStatus = async (userId: string, subId: string, payload: any) => {
//     const { orderId } = payload;
//     if (!orderId) return;

//     subsClient.sub(userId, subId, orderId); // userId, subId, "order_status"

//     const status = orderStatusStore.get(orderId);

//     if (status) {
//         if (status.ok) {
//             // return subsClient.push(userId, orderId , status.status);
//             return subsClient.push(userId, "order_status")
//         } else {
//             return subsClient.pushErrAndDrop(userId, orderId, status.err);
//         }
//     }
// }

export const ackSubscribedOrderStatus = async (userId: string, topic: string, payload: any) => {
    const { orderId } = payload;
    if (!orderId) return;

    const status = orderStatusStore.get(orderId);

    if (status) {
        if (status.ok) {
            // return subsClient.push(userId, orderId , status.status);
            return subsClient.push(userId, topic, status.status);
        } else {
            // return subsClient.pushErrAndDrop(userId, orderId, status.err);
            return subsClient.pushErrAndDrop(userId, topic, status.err);
        }
    }
}


