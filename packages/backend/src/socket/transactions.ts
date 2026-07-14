import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import { tryCatchAsync } from "@/utils/try-catch.js";
import { subsClient, wsClient } from "@/ws_client.js";
import { getBase64Encoder, getTransactionDecoder, type Blockhash, assertIsFullySignedTransaction, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED, isSolanaError, getCompiledTransactionMessageDecoder, decompileTransactionMessage, type Address, type Instruction, type StringifiedBigInt, stringifiedBigInt, address, type Base64EncodedWireTransaction, getBase58Decoder } from "@solana/kit";
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
import { inspect } from "util";
import { toUiAmount } from "@/utils/utils.js";
import sql from "@/internal/db.js";


const TERMINAL_TTL_MS = 2 * 60 * 1000;
type SignedTx = {
    wireTx: Base64EncodedWireTransaction,
    blockhash: Blockhash,
    lastValidBlockHeight: string,
}

type UpdateError = { code: string; message?: string };

type OrderStatus =
    | { ok: true; status: "FILLED", data: ParsedTransaction }
    | { ok: true; status: "EXECUTING" | "EXECUTION_FAILED" }
    | { ok: false; err: UpdateError };

type TransactionStatusUpdate = {
    edgeId: string;
    orderStatus: OrderStatus;
}

const orderStatusStore = {
    store: new Map<string, OrderStatus>(),
    timers: new Map<string, NodeJS.Timeout>(),

    // setAndPush(status: "EXECUTING" | "FILLED") => void,
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

    return subsClient.push(userId, "order_status", status);
}

export const sendTransaction = (userId: string, id: string, data: any) => {
    const { signedTx } = data;
    const op = 9;

    if (!signedTx) {
        return wsClient.pub(userId, {
            op,
            id,
            status: 400,
            error: { code: "MISSING_TX", message: "Transaction required" },
        });
    }

    const orderId = crypto.randomUUID();
    setAndPushOrderStatus(userId, orderId, { ok: true, status: "EXECUTING" });
    processTx(userId, orderId, data);

    return wsClient.pub(userId, {
        op,
        id,
        status: 200,
        data: { orderId },
    });
}

export const processTx = async (userId: string, orderId: string, data: any) => {
    // zod
    const { signedTx, edgeId } = data;
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

    // const simulation = await solanaRpc.simulateTransaction(signedTx.wireTx, { encoding: "base64" }).send();
    // if (simulation.value.err){
    // }

    const compiled = getCompiledTransactionMessageDecoder().decode(decodedWireTx.messageBytes);
    const message = decompileTransactionMessage(compiled);
    const parsedTx = parseTransfer(message.instructions, compiled.header);
    if (!parsedTx) {
        console.error("failed parsing tx");
        return
    }

    const sig = fullTx.signatures[parsedTx.from]
    if (!sig) {
        console.error("expected signature not found for sender", parsedTx.from);
        return;
    }
    const [tx] = await sql`
        INSERT INTO transactions (order_id, edge_id, mint, amount, ui_amount, fee_amount, ui_fee_amount, signature, status)
        VALUES (
            ${orderId},
            ${edgeId},
            ${parsedTx.tokenMint},
            ${parsedTx.amountInfo.amount},
            ${parsedTx.amountInfo.uiAmount},
            ${parsedTx.amountInfo.feeAmount},
            ${parsedTx.amountInfo.uiFeeAmount},
            ${getBase58Decoder().decode(sig)},
            'pending'
        )
        RETURNING *; 
        `;

    console.log("inserted tx", tx);
    const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(fullTx, { commitment: "confirmed" }));

    if (txErr) {
        const errCode = isSolanaError(txErr, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED) ? "BLOCKHASH_EXPIRED" : "TX_FAILED";
        return setAndPushOrderStatus(userId, orderId, { ok: false, err: { code: errCode } });
    }

    return setAndPushOrderStatus(userId, orderId, { ok: true, status: "FILLED", data: parsedTx });
}

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
    from: Address;
    to: Address;
    tokenMint: Address;
    amountInfo: {
        amount: StringifiedBigInt, uiAmount: string, feeAmount: StringifiedBigInt, uiFeeAmount: string;
    }
}

const parseTransfer = (instructions: Instruction[], header: any): ParsedTransaction | null => {
    for (const ix of instructions) {
        const key = `${ix.programAddress}:${getDiscriminator(ix.data)}`
        const handler = parsers[key];

        if (!handler) continue

        let parsedTx = handler(instructions);
        if (!parsedTx) return null

        parsedTx.amountInfo.feeAmount = stringifiedBigInt((5000n * BigInt(header.numSignerAccounts)).toString());
        parsedTx.amountInfo.uiFeeAmount = toUiAmount(5000n * BigInt(header.numSignerAccounts), 9);

        return parsedTx;
    }

    return null;
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
    const { accounts: ataAccs, data: ataInfo } = parseCreateAssociatedTokenIdempotentInstruction(ataIx);

    if (transferCheckedAccs.authority.address === ataAccs.payer.address /*from*/ && transferCheckedAccs.destination.address === ataAccs.ata.address/*to*/ && transferCheckedAccs.mint.address === ataAccs.mint.address) {
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


