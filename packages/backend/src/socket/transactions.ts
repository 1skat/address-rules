import { sendAndConfirmSolanaTransaction } from "@/internal/rpc.js";
import { tryCatchAsync } from "@/utils/try-catch.js";
import { subsClient, wsClient, type SocketError } from "@/ws_client.js";
import { getBase64Encoder, getTransactionDecoder, type Blockhash, assertIsFullySignedTransaction, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED, isSolanaError, getCompiledTransactionMessageDecoder, decompileTransactionMessage, type Address, type Instruction, type StringifiedBigInt, stringifiedBigInt, address, type Base64EncodedWireTransaction, getBase58Decoder, type CompiledTransactionMessage, type Signature } from "@solana/kit";
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
import sql from "@/internal/db.js";
import { toUiAmount } from "@/utils/utils.js";
import { inspect } from "util";


const TERMINAL_TX_TTL_MS = 2 * 60 * 1000;

export type TokenMeta = {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    iconURI?: string;
}

export type OrderStatus =
    | { edgeId: string, status: "EXECUTING" }
    | { edgeId: string, status: "FILLED", data: ParsedTransaction }
    | { edgeId: string, status: "EXECUTION_FAILED", err: SocketError };


const orderStatusStore = {
    store: new Map<string, OrderStatus>(),
    timers: new Map<string, NodeJS.Timeout>(),

    scheduleCleanup(orderId: string) {
        const existing = this.timers.get(orderId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.store.delete(orderId)
            this.timers.delete(orderId);
        }, TERMINAL_TX_TTL_MS);

        this.timers.set(orderId, timer);
    },
    set(orderId: string, status: OrderStatus) {
        this.store.set(orderId, status);

        if (status.status !== "EXECUTING") this.scheduleCleanup(orderId);
    },
    get(orderId: string) {
        return this.store.get(orderId);
    }
}

// helpers
const setAndPushOrderStatus = (userId: string, orderId: string, os: OrderStatus): void => {
    orderStatusStore.set(orderId, os);
    if (os.status === "EXECUTION_FAILED") return subsClient.pushErrAndDrop(userId, "order_status", os.err);

    return subsClient.push(userId, "order_status", os);
}

export const sendTransaction = (userId: string, id: string, data: any) => {
    const { signedTx, edgeId } = data;
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

    setAndPushOrderStatus(userId, orderId, { edgeId, status: "EXECUTING" });
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

    try {
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

        const compiled = getCompiledTransactionMessageDecoder().decode(decodedWireTx.messageBytes);
        let parsedTx = await parseTransfer(compiled);
        if (!parsedTx) {
            console.error("failed parsing tx");
            return
        }

        const sigBytes = fullTx.signatures[parsedTx.from]
        if (!sigBytes) {
            console.error("expected signature not found for sender", parsedTx.from);
            return;
        }
        const sig = getBase58Decoder().decode(sigBytes) as Signature;
        parsedTx.signature = sig;

        const [tx] = await sql`
        INSERT INTO transactions (order_id, edge_id, mint, amount, ui_amount, fee_amount, ui_fee_amount, signature, status)
        VALUES (
            ${orderId},
            ${edgeId},
            ${parsedTx.tokenMeta.mint},
            ${parsedTx.amountInfo.amount},
            ${parsedTx.amountInfo.uiAmount},
            ${parsedTx.amountInfo.feeAmount},
            ${parsedTx.amountInfo.uiFeeAmount},
            ${parsedTx.signature},
            'pending'
            )
            RETURNING *; 
            `;

        console.log("inserted tx", tx);
        const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(fullTx, { commitment: "confirmed" }));

        if (txErr) {
            const errCode = isSolanaError(txErr, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED) ? "BLOCKHASH_EXPIRED" : "TX_FAILED";
            return setAndPushOrderStatus(userId, orderId, { edgeId, status: "EXECUTION_FAILED", err: { code: errCode } });
        }

        return setAndPushOrderStatus(userId, orderId, { edgeId, status: "FILLED", data: parsedTx });
    } catch (err) {
        console.error(err)
        return setAndPushOrderStatus(userId, orderId, { edgeId, status: "EXECUTION_FAILED", err: { code: "TX_FAILED" } });
    }
}

export const ackSubscribedOrderStatus = async (userId: string, topic: string, payload: any) => {
    const { orderId, edgeId } = payload;
    const status = orderStatusStore.get(orderId);

    if (status) {
        if (status.status === "EXECUTION_FAILED") {
            return subsClient.pushErrAndDrop(userId, topic, status);
        }
        return subsClient.push(userId, topic, status);
    }
    const orderStatus: OrderStatus = { edgeId, status: "EXECUTION_FAILED", err: { code: "ORDER_STATUS_NOT_FOUND" } };
    return subsClient.pushErrAndDrop(userId, topic, orderStatus);
}

type ParsedTransaction = {
    from: Address;
    to: Address;
    tokenMeta: TokenMeta,
    amountInfo: {
        amount: StringifiedBigInt, uiAmount: string, feeAmount: StringifiedBigInt, uiFeeAmount: string;
    };
    signature: Signature;
}

const parseTransfer = async (ctm: CompiledTransactionMessage): Promise<ParsedTransaction | null> => {
    const message = decompileTransactionMessage(ctm);
    for (const ix of message.instructions) {
        const key = `${ix.programAddress}:${getDiscriminator(ix.data)}`
        const handler = parsers[key];

        if (!handler) continue

        const parsedTx = await handler(message.instructions);
        if (!parsedTx) return null

        console.log(inspect(parsedTx, { depth: null }))
        parsedTx.amountInfo.feeAmount = stringifiedBigInt((5000n * BigInt(ctm.header.numSignerAccounts)).toString());
        parsedTx.amountInfo.uiFeeAmount = toUiAmount(5000n * BigInt(ctm.header.numSignerAccounts), 9);

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
        tokenMeta: {
            mint: "11111111111111111111111111111111",
            symbol: "SOL",
            name: "Solana",
            decimals: 9
        },
        amountInfo: {
            amount: stringifiedBigInt(parsed.data.amount.toString()),
            uiAmount: (Number(parsed.data.amount) / 10 ** 9).toString(),
        }
    }
}
async function handleTokenTransferChecked(ixs: Instruction[]) {
    const checkedTransfer = ixs.find(ix => identifyTokenInstruction(ix) === TokenInstruction.TransferChecked)
    if (!checkedTransfer) return null;

    const ataIx = ixs.find(ix => identifyAssociatedTokenInstruction(ix) === AssociatedTokenInstruction.CreateAssociatedTokenIdempotent)
    if (!ataIx) return null;

    const { accounts: transferCheckedAccs, data: amountInfo } = parseTransferCheckedInstruction(checkedTransfer);
    const { accounts: ataAccs, data: ataInfo } = parseCreateAssociatedTokenIdempotentInstruction(ataIx);

    const [token] = await sql`SELECT chain_id, address, symbol, name, decimals FROM tokens WHERE chain_id = '501' AND address = ${transferCheckedAccs.mint.address}`;
    if (!token) {
        // fetch the metadata from chain
        console.error("token metadata not found")
        return null;
    }

    if (transferCheckedAccs.authority.address === ataAccs.payer.address /*from*/ && transferCheckedAccs.destination.address === ataAccs.ata.address/*to*/ && transferCheckedAccs.mint.address === ataAccs.mint.address) {
        return {
            from: transferCheckedAccs.authority.address,
            to: ataAccs.owner.address,
            tokenMeta: {
                mint: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
            },
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


