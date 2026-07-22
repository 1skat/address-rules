import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import { toUiAmount } from "@/utils/utils.js";
import { subsClient } from "@/ws_client.js";
import { address, stringifiedBigInt, type Address, type Lamports, type Signature, type StringifiedBigInt, type StringifiedNumber } from "@solana/kit";
import util, { inspect } from "util";
import type { TokenMeta } from "./transactions.js";
import { tokensStore, userWalletsStore } from "./mem_cache.js";
import { tryCatchAsync } from "@/utils/try-catch.js";

type UserWalletInit = {
    type: "SNAPSHOT";
    snapshot: { [k: string]: { id: string, address: Address } };
}
type UserWalletUpdate = {
    type: "BALANCE_UPDATE";
    chainId: "501" | "60";
    data: WalletTokenUpdates; // todo: it has to contian id but keep in mind that wallet-addresses could be unkown and are coming anywhere from chain
}
type WalletId = string;

// type WalletTokenUpdate = { walletId: WalletId, updates: TokenUpdate[] }
type WalletTokenUpdates = Record<WalletId, TokenUpdate[]>;

const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

type TokenUpdate = {
    isNewToken: boolean;
    tokenId: string;
    tokenMeta: TokenMeta;
    balance: {
        amount: StringifiedBigInt;
        uiAmount: string;
    }
}
type WalletTokenBalanceChange = {
    walletId: string,
    // walletAddress: Address,
    mint: Address,
    amountInfo: {
        amount: StringifiedBigInt;
        decimals: number;
        uiAmount: string;
    }

}


const parseTxBalancesChanges = (data: GetTranscationResult): WalletTokenBalanceChange[] => {
    const { meta, transaction } = data;
    if (!meta || !transaction) throw new Error("no meta/transaction found, handle the err over ws");

    const balanceChanges: WalletTokenBalanceChange[] = [];

    for (const [idx, ak] of transaction.message.accountKeys.entries()) {
        if (walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx]) { // this gives only tracked user's wallet addresses
            const walletId = userWalletsStore.get(ak.pubkey)?.id;
            if (!walletId) continue;

            balanceChanges.push({
                walletId: walletId,
                mint: address("11111111111111111111111111111111"),
                amountInfo: {
                    amount: stringifiedBigInt(meta.postBalances[idx]!.toString()),
                    decimals: 9,
                    uiAmount: toUiAmount(meta.postBalances[idx]!, 9),
                }
            })
        }
    }

    if (meta.postTokenBalances) {
        const preTokenBalancesMap = new Map(meta.preTokenBalances?.map(b => [b.accountIndex, b]) ?? []);

        for (const postB of meta.postTokenBalances) {
            if (!postB.owner || !walletStore.has(postB.owner)) continue;

            const preB = preTokenBalancesMap.get(postB.accountIndex);
            if (!preB /* new post balance, new token */ || preB.uiTokenAmount.amount !== postB.uiTokenAmount.amount) {
                const walletId = userWalletsStore.get(postB.owner)?.id; // check wether a new token's owner is a user's wallet address that is being tracked
                if (!walletId) {
                    console.error(`SKIPPED: wallet ${postB.owner} isnt being tracked. postBalance: ${postB}`,)
                    continue;
                }
                balanceChanges.push({
                    walletId,
                    // walletAddress: postB.owner,
                    mint: postB.mint,
                    amountInfo: {
                        amount: postB.uiTokenAmount.amount,
                        decimals: postB.uiTokenAmount.decimals,
                        uiAmount: postB.uiTokenAmount.uiAmountString,
                    }
                });
            }
        }
    }

    return balanceChanges;
}
const addNewTokenToDB = async () => {
    // need to fetch the tokens mata off chain based on mint then add it to the db and return the tokeMeta
}

const addNewTokenToUserWallet = async (userId: string, userWalletAddress: Address, tokenMint: Address): Promise<TokenMeta | null> => {
    // just simulating
    console.log("adding new token to db...")
    if (tokenMint === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") {
        const [token] = await sql`
        WITH inserted AS (
        INSERT INTO tokens(id, chain_id, address, symbol, name, decimals, deployed_at)  
            VALUES('501', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'USDC', 'USDC', 6, to_timestamp(1721427641))
            ON CONFLICT(chain_id, address) DO NOTHING
            RETURNING *
        )
        SELECT * FROM inserted
        UNION ALL
        SELECT * FROM tokens
        WHERE address = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
        AND NOT EXISTS(SELECT 1 FROM inserted)
        `
        if (!token) return null;

        return {
            tokenId: token.id,
            chainId: token.chain_id,
            mint: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals
        };
    }
    if (tokenMint === "11111111111111111111111111111111") {
        const [token] = await sql`SELECT id, chain_id, address, symbol, name, decimals FROM tokens WHERE address = '11111111111111111111111111111111'`;
        if (!token) return null;
        console.log('row', token)

        return {
            tokenId: token.id,
            chainId: token.chain_id,
            mint: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals
        };
    }
    return null;
}

const getWalletTokenUpdatesV2 = async (
    changes: WalletTokenBalanceChange[],
    handleNewToken: (tokenMint: Address) => Promise<TokenMeta | null>
): Promise<WalletTokenUpdates> => {
    if (!changes) throw new Error("NO_CHANGES");
    const updates: WalletTokenUpdates = {};

    for (const change of changes) {
        const userTokenUpdates = updates[change.walletId] ??= [];

        const token = tokensStore.get(change.mint) ?? await handleNewToken(change.mint);
        if (!token) {
            console.error("token meta missing")
            continue;
        }
        const [inserted, err] = await tryCatchAsync(() =>
            // it runs over all wallets in change
            sql`
                INSERT INTO wallet_tokens(wallet_id, token_id)
                VALUES(${change.walletId}, ${token.tokenId})
                ON CONFLICT(wallet_id, token_id) DO NOTHING
                RETURNING * `);
        if (err) {
            throw new Error("Adding token to user wallet");
        }

        console.log("new token inserted", inserted.length > 0, inserted)
        userTokenUpdates.push({
            isNewToken: inserted.length > 0,
            tokenId: token.tokenId,
            tokenMeta: {
                tokenId: token.tokenId,
                chainId: token.chainId,
                mint: token.mint,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
            },
            balance: {
                amount: change.amountInfo.amount,
                uiAmount: change.amountInfo.uiAmount,
            }
        });
    }

    return updates;
}


export const ackSubscribedUserWallets = async (userId: string, topic: string): Promise<void> => {
    // TODO (A): probably dont need to actually do it because it need to pull FROM hot-cache ? redis : DB
    const allUserWallets = await sql`SELECT id, address FROM wallets w WHERE w.archived = false AND w.account_id = ${userId} `;
    const allTokens = await sql`SELECT id, chain_id, address, symbol, name, decimals FROM tokens WHERE chain_id = '501'`;

    allUserWallets.forEach(w => userWalletsStore.set(w.address, { id: w.id, address: address(w.address) }));
    allTokens.forEach(t => tokensStore.set(t.address, { // move to outer scope since its on load
        tokenId: t.id,
        chainId: t.chain_id,
        mint: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
    }));

    // const allUserWalletTokens = await sql`
    //     SELECT w.id as wallet_id, w.address as wallet_address,
    //     COALESCE(json_agg(
    //         json_build_object(
    //             'token_id', t.id,
    //             'chain_id', t.chain_id,
    //             'token_address', t.address,
    //             'symbol', t.symbol,
    //             'name', t.name,
    //             'decimals', t.decimals
    //         )), '[]') as token_list
    //     FROM wallets w
    //     JOIN wallet_tokens wt ON wt.wallet_id = w.id
    //     JOIN tokens t ON wt.token_id = t.id
    //     WHERE w.account_id = ${userId}
    //     AND w.archived = false
    //     GROUP BY w.id, w.address
    //     `;

    allUserWallets.forEach(w => startTrackingSolanaAddress(w.address, async (txData: GetTranscationResult) => {
        const changes = parseTxBalancesChanges(txData);
        const walletTokenUpdates = await getWalletTokenUpdatesV2(changes, (tokenMint: Address) => addNewTokenToUserWallet(userId, w.address, tokenMint));

        const msg: UserWalletUpdate = {
            type: "BALANCE_UPDATE",
            chainId: "501",
            data: walletTokenUpdates,
        }
        return subsClient.push(userId, topic, msg);
    }));
}

