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
    tokenId: string;
    chainId: string;
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    iconURI?: string;
}

type EdgeTokenData = {
    mint: string;
    tokenMeta: TokenMeta;
    totalAmountInfo: {
        amount: StringifiedBigInt;
        uiAmount: string;
    }
}

export type OrderStatus =
    | { edgeId: string, tokenId: string, status: "EXECUTING" }
    | { edgeId: string, tokenId: string, status: "FILLED", data: EdgeTokenData }
    | { edgeId: string, tokenId: string, status: "EXECUTION_FAILED", err: SocketError };


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
    const { signedTx, edgeId, tokenId } = data;
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

    setAndPushOrderStatus(userId, orderId, { edgeId, tokenId, status: "EXECUTING" }); // only send it here to avoid the reace condition
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
    const { signedTx, edgeId, tokenId } = data;

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
        const parsedTx = await parseTransfer(compiled);
        if (!parsedTx) {
            console.error("failed parsing tx");
            return
        }

        if (parsedTx.tokenMeta.tokenId !== tokenId) {
            console.error("token ids do not match")
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
        INSERT INTO transactions (order_id, edge_id, token_id, amount, ui_amount, fee_amount, ui_fee_amount, signature, status)
        VALUES (
            ${orderId},
            ${edgeId},
            ${parsedTx.tokenMeta.tokenId},
            ${parsedTx.amountInfo.amount},
            ${parsedTx.amountInfo.uiAmount},
            ${parsedTx.amountInfo.feeAmount},
            ${parsedTx.amountInfo.uiFeeAmount},
            ${parsedTx.signature},
            'EXECUTING'
            )
            RETURNING *; 
            `;

        const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(fullTx, { commitment: "confirmed" }));

        if (txErr) {
            const errCode = isSolanaError(txErr, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED) ? "BLOCKHASH_EXPIRED" : "TX_FAILED";
            await sql`UPDATE transactions SET status = 'EXECUTION_FAILED' WHERE order_id = ${orderId}`;
            return setAndPushOrderStatus(userId, orderId, { edgeId, tokenId, status: "EXECUTION_FAILED", err: { code: errCode } });
        }

        const totalAmount: string = await sql.begin(async sql => {
            await sql`UPDATE transactions SET status = 'FILLED' WHERE order_id = ${orderId}`;
            const [total] = await sql`
            INSERT INTO edge_token_totals (edge_id, token_id, total_amount)
            SELECT ${edgeId}, ${parsedTx.tokenMeta.tokenId}, COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE edge_id = ${edgeId} AND token_id = ${parsedTx.tokenMeta.tokenId} AND status = 'FILLED'
            ON CONFLICT (edge_id, token_id) DO UPDATE SET total_amount = EXCLUDED.total_amount, updated_at = now()
            RETURNING total_amount
            `;
            if (!total) throw new Error();

            return total.total_amount;
        });
        if (!totalAmount) {
            return;
        }

        return setAndPushOrderStatus(userId, orderId, {
            edgeId, tokenId, status: "FILLED", data: {
                mint: parsedTx.tokenMeta.mint, // i dont need that
                tokenMeta: parsedTx.tokenMeta, // dont need that, cuz the meta alreadt exists or the call is made
                totalAmountInfo: {
                    amount: stringifiedBigInt(totalAmount),
                    uiAmount: toUiAmount(BigInt(totalAmount), parsedTx.tokenMeta.decimals),
                }
            }
        });
    } catch (err) {
        console.error(err)
        await sql`UPDATE transactions SET status = 'EXECUTION_FAILED' WHERE order_id = ${orderId}`;
        return setAndPushOrderStatus(userId, orderId, { edgeId, tokenId, status: "EXECUTION_FAILED", err: { code: "TX_FAILED" } });
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


async function handleSystemTransfer(ixs: Instruction[]) {
    const solTransfer = ixs.find(ix => identifySystemInstruction(ix) === SystemInstruction.TransferSol);
    if (!solTransfer) return null;

    const parsed = parseTransferSolInstruction(solTransfer);
    // do redis or ttl cache look up
    const [token] = await sql`SELECT id, chain_id, address, symbol, name, decimals FROM tokens WHERE chain_id = '501' AND address = '11111111111111111111111111111111'`;
    if (!token) {
        // fetch the metadata from chain
        console.error("token metadata not found")
        return null;
    }

    return {
        from: parsed.accounts.source.address,
        to: parsed.accounts.destination.address,
        tokenMeta: {
            tokenId: token.id,
            chainId: "501",
            mint: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
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

    const [token] = await sql`SELECT id, chain_id, address, symbol, name, decimals FROM tokens WHERE chain_id = '501' AND address = ${transferCheckedAccs.mint.address}`;
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
                tokenId: token.id,
                chainId: "501",
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


