import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import { tryCatchAsync } from "@/utils/try-catch.js";
import { subsClient, wsClient } from "@/ws_client.js";
import { getBase64Encoder, getTransactionDecoder, type Blockhash, assertIsFullySignedTransaction, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED, isSolanaError, getCompiledTransactionMessageDecoder, decompileTransactionMessage, type Address, type Instruction, type StringifiedBigInt, stringifiedBigInt, address } from "@solana/kit";
import {
    identifyTokenInstruction,
    TOKEN_PROGRAM_ADDRESS,
    TokenInstruction,
    parseTransferCheckedInstruction,
    identifyAssociatedTokenInstruction,
    AssociatedTokenInstruction,
    parseCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token";
import { identifySystemInstruction, SystemInstruction, SYSTEM_PROGRAM_ADDRESS, parseTransferSolInstruction } from "@solana-program/system";


const TERMINAL_TTL_MS = 2 * 60 * 1000;
type SignedTx = {
    wireTx: string,
    blockhash: Blockhash,
    lastValidBlockHeight: string,
}
type OrderStatus =
    | { ok: true; status: "FILLED", data: ParsedTransaction }
    | { ok: true; status: "EXECUTING" | "EXECUTION_FAILED" }
    | { ok: false; err: { code: string; message?: string } };

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
    if (!status.ok) return subsClient.pushErrAndDrop(userId, "order_status", status.err);

    return subsClient.push(userId, "order_status", status); // push the whole status object
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

    const parsedTx = parseTransfer(message.instructions);
    if (!parsedTx) return null;

    return setAndPushOrderStatus(userId, orderId, { ok: true, status: "FILLED", data: parsedTx });
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
            return subsClient.push(userId, orderId, status);
        }
        return subsClient.push(userId, topic, status);
    }
    console.error("ackSubscribedOrderStatus: order status's value empty")
    return subsClient.pushErrAndDrop(userId, topic, { code: "ORDER_STATUS_NOT_FOUND" });
}


type ParsedTransaction = {
    from: Address, to: Address, tokenMint: Address, amountInfo: { amount: StringifiedBigInt, uiAmount: string }
}
const parseTransfer = (instructions: Instruction[]): ParsedTransaction | null => {
    for (const ix of instructions) {
        const key = `${ix.programAddress}:${getDiscriminator(ix.data)}`
        const handler = parsers[key];

        if (!handler) continue

        const result = handler(instructions);
        if (!result) return null

        return result;
    }
}
function handleSystemTransfer(ixs: Instruction[]) {
    const solTransfer = ixs.find(ix => identifySystemInstruction(ix) === SystemInstruction.TransferSol);
    if (!solTransfer) return null;

    const parsed = parseTransferSolInstruction(solTransfer);

    return {
        from: parsed.accounts.source.address,
        to: parsed.accounts.destination.address,
        tokenMint: address("11111111111111111111111111111111"),
        amountInfo: {
            amount: stringifiedBigInt(parsed.data.amount.toString()),
            uiAmount: (Number(parsed.data.amount) / 10 ** 9).toString(),
        }
    }
}
function handleTokenTransferChecked(ixs: Instruction[]): ParsedTransaction | null {
    const checkedTransfer = ixs.find(ix => identifyTokenInstruction(ix) === TokenInstruction.TransferChecked)
    if (!checkedTransfer) return null;

    const ataIx = ixs.find(ix => identifyAssociatedTokenInstruction(ix) === AssociatedTokenInstruction.CreateAssociatedTokenIdempotent)
    if (!ataIx) return null;

    const { accounts: transferCheckedAccs, data: amountInfo } = parseTransferCheckedInstruction(checkedTransfer);
    const { accounts: ataAccs } = parseCreateAssociatedTokenIdempotentInstruction(ataIx);

    if (transferCheckedAccs.authority === ataAccs.payer /*from*/ && transferCheckedAccs.destination === ataAccs.ata/*to*/ && transferCheckedAccs.mint === ataAccs.mint) {
        return {
            from: transferCheckedAccs.authority.address,
            to: ataAccs.owner.address,
            tokenMint: transferCheckedAccs.mint.address,
            amountInfo: {
                amount: stringifiedBigInt(amountInfo.amount.toString()),
                uiAmount: (Number(amountInfo.amount) / 10 ** amountInfo.decimals).toString(),
            }
        }
    }

    return null;
}
const parsers: Record<string, (ixs: Instruction[]) => ParsedTransaction | null> = {
    [`${SYSTEM_PROGRAM_ADDRESS}:2`]: handleSystemTransfer,
    [`${TOKEN_PROGRAM_ADDRESS}:12`]: handleTokenTransferChecked,
}
function getDiscriminator(txData: Uint8Array) {
    try {
        return txData[0];
    } catch {
        return null;
    }
}


