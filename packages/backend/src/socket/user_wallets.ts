import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import { toUiAmount } from "@/utils/utils.js";
import { subsClient } from "@/ws_client.js";
import { address, stringifiedBigInt, type Address, type Lamports, type Signature, type StringifiedBigInt, type StringifiedNumber } from "@solana/kit";
import util, { inspect } from "util";
import type { TokenMeta } from "./transactions.js";

type UserWalletInit = {
    type: "SNAPSHOT",
    snapshot: any[],
}
type UserWalletUpdate = {
    type: "BALANCE_UPDATE";
    chainId: "501" | "60";
    walletTokenUpdates: WalletTokenUpdate[]; // todo: it has to contian id but keep in mind that wallet-addresses could be unkown and are coming anywhere from chain
}

type WalletTokenUpdate = { walletAddress: Address, updates: TokenUpdate[] }

const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

type TokenUpdate = {
    tokenMeta: TokenMeta;
    balance: {
        amount: StringifiedBigInt;
        uiAmount: string;
    }
}
type WalletTokenBalanceChange = {
    walletAddress: Address,
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
        if (walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx]) {
            balanceChanges.push({
                walletAddress: ak.pubkey, mint: address("11111111111111111111111111111111"),
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
                balanceChanges.push({
                    walletAddress: postB.owner,
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

    // todo: maybe change to Record<walletAddress, tokenUpdate>
    return balanceChanges;
}
const addNewTokenToUserWallet = async (userId: string, userWalletAddress: Address, tokenMint: Address) => {
    // hot tokens metadata from redis
    // else take the metadata from the tokens table if not found, add new token meta to tokens table
    // const res = solanaRpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    // console.log("token meta", util.inspect(res, { depth: null }));

    console.log("adding new token to db...")
    if (tokenMint === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") {
        const [token] = await sql`
        WITH inserted AS (
            INSERT INTO tokens (id, chain_id, address, symbol, name, decimals, deployed_at)  
            VALUES ('501', '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'USDC', 'USDC', 6, to_timestamp(1721427641))
            ON CONFLICT (chain_id,address) DO NOTHING
            RETURNING *
        )
        SELECT * FROM inserted
        UNION ALL
        SELECT * FROM tokens
        WHERE address = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
        AND NOT EXISTS (SELECT 1 FROM inserted)
        `
        if (!token) return null;

        return {
            tokenId: token.id,
            chainId: token.chain_id,
            tokenAddress: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals
        };
    }
    if (tokenMint === "11111111111111111111111111111111") {
        const [token] = await sql`SELECT id, chain_id, address, symbol, name, decimals FROM tokens WHERE address = '11111111111111111111111111111111'`;
        if (!token) return null;

        return {
            tokenId: token.id,
            chainId: token.chain_id,
            tokenAddress: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals
        };
    }
    return null;
}

const getWalletTokenUpdates = async (
    changes: WalletTokenBalanceChange[],
    userWalletTokensMeta: Map<string, TokenMeta>,
    handleNewWallet: (newAccData: any) => Promise<void>,
): Promise<WalletTokenUpdate[]> => {
    if (!changes) throw new Error("NO_CHANGES");

    const tokenUpdates = new Map<Address, TokenUpdate[]>(); // [walletAddress]: TokenUpdates[]

    for (const change of changes) {
        console.log("change for wa", change);
        if (!tokenUpdates.has(change.walletAddress)) {
            tokenUpdates.set(change.walletAddress, []);
        }

        const userTokenUpdates = tokenUpdates.get(change.walletAddress)!;
        if (change.mint === "11111111111111111111111111111111") {
            const token = userWalletTokensMeta.get(change.mint) ?? await handleNewWallet(change.mint);
            if (!token) {
                console.error("token meta missing")
                continue;
            }
            userTokenUpdates.push({
                tokenMeta: {
                    tokenId: token.tokenId,
                    chainId: token.chainId,
                    mint: "11111111111111111111111111111111",
                    symbol: "SOL",
                    name: "Solana",
                    decimals: 9,
                },
                balance: {
                    amount: stringifiedBigInt(change.amountInfo.amount),
                    uiAmount: change.amountInfo.uiAmount, // create a function
                }
            });
        } else {
            const token = userWalletTokensMeta.get(change.mint) ?? await handleNewWallet(change.mint)
            console.log(token)
            if (!token) {
                console.error("token meta missing")
                continue;
            }

            userTokenUpdates.push({
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
    }

    console.log("final token updates", inspect(tokenUpdates, { depth: null }));
    return [...tokenUpdates].map(([walletAddress, updates]) => ({ walletAddress, updates })) // todo: probably wanna do the Record
}
// [...tokenUpdates].map(([walletAddress, tokenUpdates]) => ({ walletAddress, tokenUpdates }));

// changes.walletNativeBalanceUpdates.forEach(change => {
//     updates.set(change.accountAddress, [{
//         mint: "11111111111111111111111111111111",
//         symbol: "SOL",
//         name: "Solana",
//         balance: {
//             amount: stringifiedBigInt(change.balance),
//             decimals: 9,
//             uiAmount: change.balance, // create a function

//         }
//     }]);
// });

// if (changes.walletTokenBalanceUpdates) {
//     console.log("wallet token balances exists");
//     console.log("user wallet tokens", userWalletTokens);
//     for (const change of changes.walletTokenBalanceUpdates) {
//         console.log("change mint", change.mint);
//         const tokenMeta = userWalletTokens.get(change.mint) ?? await handleNewWallet(change.mint);
//         if (!tokenMeta) continue;
//         console.log("TOKEN META", tokenMeta);

//         console.log("change", change);
//         const userUpdates = updates.get()
//         updates.get(change.walletAddress)?.push({
//             mint: tokenMeta.token_address,
//             symbol: tokenMeta.symbol,
//             name: tokenMeta.name,
//             balance: {
//                 amount: change.amountInfo.amount,
//                 decimals: change.amountInfo.decimals,
//                 uiAmount: change.amountInfo.uiAmountString,
//             }
//         });
//     }
// }


export const ackSubscribedUserWallets = async (userId: string, topic: string): Promise<void> => {
    // subsClient.sub(userId, subId, "wallet_updates");

    // inner join cuz each wallet has >= 1 token (SOL)
    // const allUserTokens = await sql`
    // SELECT DISTINCT t.address, t.symbol, t.name, t.decimals
    // FROM wallets w
    // JOIN wallet_tokens wt ON wt.wallet_id = w.id
    // JOIN tokens t ON wt.token_id = t.id
    // WHERE w.account_id = ${userId}
    // `

    // pull user's owned tokens 
    // TODO (A): probably dont need to actually do it because it need to pull from hot cache then db
    const allUserWalletTokens = await sql`
        SELECT w.id as wallet_id, w.address as wallet_address,
        COALESCE(json_agg(
            json_build_object(
                'chain_id', t.chain_id,
                'token_address', t.address,
                'symbol', t.symbol,
                'name', t.name,
                'decimals', t.decimals
            )), '[]') as token_list
        FROM wallets w
        JOIN wallet_tokens wt ON wt.wallet_id = w.id
        JOIN tokens t ON wt.token_id = t.id
        WHERE w.account_id = ${userId}
        AND w.archived = false
        GROUP BY w.id, w.address
        `;

    console.log(util.inspect(allUserWalletTokens, { depth: null }))

    const allUserTokens = allUserWalletTokens.reduce((tokenMap, wt) => {
        for (const token of wt.token_list) {
            const meta: TokenMeta = {
                tokenId: token.id,
                chainId: token.chain_id,
                mint: token.token_address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
            }
            tokenMap.set(token.token_address, meta);
        }
        return tokenMap;
    }, new Map());

    if (!allUserWalletTokens) {
        console.error("subscribeUserWallets: wallet not found")
        return subsClient.pushErrAndDrop(userId, topic, { code: "NO_TOKENS_FOUND" });
    }

    const msg: UserWalletInit = {
        type: "SNAPSHOT",
        snapshot: allUserWalletTokens, // send as record, fix fields
    }
    subsClient.push(userId, topic, msg);

    allUserWalletTokens.forEach(wt => startTrackingSolanaAddress(wt.wallet_address, async (txData: GetTranscationResult) => {
        // note: callbackHandler is used once per signature to update all the wallets inside of it
        // updates are for the UI only, dont store ata accounts or balances
        const changes = parseTxBalancesChanges(txData); // can have multple updates from different wallets
        const walletTokenUpdates = await getWalletTokenUpdates(changes, allUserTokens, (newTokenData: any) => addNewTokenToUserWallet(userId, wt.wallet_address, newTokenData)); // updates is a list of userTokens with updates balances

        const msg: UserWalletUpdate = {
            type: "BALANCE_UPDATE",
            chainId: "501",
            walletTokenUpdates: walletTokenUpdates, // todo: it has to contian id but keep in mind that wallet-addresses could be unkown and are coming anywhere from chain
        }
        return subsClient.push(userId, topic, msg);
    }));
}


