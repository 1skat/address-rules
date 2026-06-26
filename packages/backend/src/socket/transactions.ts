import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { tryCatchAsync } from "@/utils/try-catch.js";

const TERMINAL_TTL_MS = 2 * 60 * 1000;
type OrderStatus =
    | { ok: true; status: "EXECUTING" | "FILLED" | "EXECUTION_FAILED" }
    | { ok: false; err: { code: string; message?: string } }

const orderStatusStore = {
    store: new Map<string, OrderStatus>(),
    timers: new Map<string, NodeJS.Timeout>(),

    scheduleCleanup(orderId: string) {
        if (this.timers.has(orderId)) this.timers.delete(orderId); // delete curr timer to avoid memort leaks

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
const setAndPushOrderStatus = (ctx: Context, orderId: string, status: OrderStatus): void => {
    orderStatusStore.set(orderId, status);
    ctx.subsClient.push(ctx.userId, orderId, status);
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
    setAndPushOrderStatus(ctx, orderId, { ok: true, status: "EXECUTING" });
    processTx(ctx, orderId, signedTx);

    return ctx.wsClient.pub(ctx.userId, {
        op,
        id,
        status: 200,
        data: { orderId }
    });
}

export const processTx = async (ctx: Context, orderId: string, signedTx: any) => {
    console.log("processTx -", orderId);
    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));

    if (txErr) {
        return setAndPushOrderStatus(ctx, orderId, { ok: false, err: { code: "INTERNAL_ERROR" } });
    }

    return setAndPushOrderStatus(ctx, orderId, { ok: true, status: "FILLED" });
}

export const subscribeOrderStatus = async (ctx: Context, subId: string, payload: any) => {
    const { orderId } = payload;
    if (!orderId) return;

    ctx.subsClient.sub(ctx.userId, subId, orderId);

    const status = orderStatusStore.get(orderId)

    if (status) {
        if (status.ok) {
            return ctx.subsClient.push(ctx.userId, orderId, status.status);
        } else {
            return ctx.subsClient.pushErrAndDrop(ctx.userId, orderId, status.err)
        }
    }
}
