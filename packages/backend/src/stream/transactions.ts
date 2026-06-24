import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { tryCatchAsync } from "@/utils/try-catch.js";

type OrderStatus = "EXECUTING" | "FILLED" | "EXECUTION_FAILED";

const orderStatusStore = new Map<string, OrderStatus>();

// helpers
const setAndPushOrderStatus = (ctx: Context, orderId: string, status: OrderStatus): void => {
    orderStatusStore.set(orderId, status);
    ctx.wsClient.push(`order:${orderId}`, status) // if a user is subed else dropped
}

export const sendTransaction = (ctx: Context, id: string, data: any) => {
    const { signedTx } = data;
    const op = 9;

    if (!signedTx) {
        return ctx.wsClient.pub(ctx.userId, {
            op,
            id,
            status: 400,
            error: { code: "MISSING_TX", message: "Transaction required" }
        });
    }

    const orderId = crypto.randomUUID();
    setAndPushOrderStatus(ctx, orderId, "EXECUTING");
    processTx(ctx, orderId, signedTx);

    return ctx.wsClient.pub(ctx.userId, {
        op,
        id,
        status: 200,
        data: { orderId }
    });
}

export const processTx = async (ctx: Context, orderId: string, signedTx: any) => {
    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

    if (txErr) {
        return setAndPushOrderStatus(ctx, orderId, "EXECUTION_FAILED");
    }

    return setAndPushOrderStatus(ctx, orderId, "FILLED");
}

export const subscribeOrderStatus = async (ctx: Context, subId: string, payload: any) => {
    const op = 5;
    const { orderId } = payload;
    if (!orderId) return;

    const topic = `order:${orderId}`;

    ctx.wsClient.subcribe(ctx.userId, subId, topic);
    const status = orderStatusStore.get(orderId)
    if (status) {
        ctx.wsClient.push(topic, status);
    }
}
