import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import { toUiAmount } from "@/utils/utils.js";
import { subsClient } from "@/ws_client.js";
import { address, stringifiedBigInt, type Address, type Lamports, type Signature, type StringifiedBigInt, type StringifiedNumber } from "@solana/kit";
import util from "util";

type UserWalletInit = {
    type: "init",
    snapshot: any[],
}
type UserWalletUpdate = {
    type: "wallet-update";
    chain: "SOLANA" | "ETHEREUM";
    tokenUpdates: { walletAddress: Address, updates: TokenUpdate[] }[]
}

const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

// type TokenBalanceInfo = {
//     walletAddress: Address;
//     mint: Address;
//     amountInfo: Readonly<{
//         amount: StringifiedBigInt;
//         decimals: number;
//         uiAmount: number | null;
//         uiAmountString: StringifiedNumber;
//     }>;
// }
// type BalanceChanges = {
//     walletNativeBalanceUpdates: AccountBalancenInfo[];
//     walletTokenBalanceUpdates?: TokenBalanceInfo[];
// }

type TokenUpdate = {
    mint: string;
    symbol: string,
    name: string,
    balance: {
        amount: StringifiedBigInt;
        decimals: number;
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

    return balanceChanges;
}
// const nativeUpdates = transaction.message.accountKeys
//     .map((ak, idx) => ({ ak, idx }))
//     .filter(({ ak, idx }) => walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx])
//     .map(({ ak, idx }) => (
//         {
//             walletAddress: ak.pubkey, mint: address("11111111111111111111111111111111"), amountInfo: {
//                 amount: stringifiedBigInt(meta.postBalances[idx]!.toString()),
//                 decimals: 9,
//                 uiAmount: meta.postBalances[idx]!.toString(),
//             }
//         }
//     ))

// const walletNativeBalanceUpdates = transaction.message.accountKeys
//     .map((ak, idx) => ({ ak, idx }))
//     .filter(({ ak, idx }) => walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx])
//     .map(({ ak, idx }) => ({ accountAddress: ak.pubkey, balance: meta.postBalances[idx]!.toString() }));

// if (!meta.postTokenBalances) return { walletNativeBalanceUpdates }; // no changes for tokens

// const preBalancesMap = new Map(
//     meta.preTokenBalances?.map(b => [b.accountIndex, b]) ?? [],
// );
// const walletTokenBalanceUpdates = meta.postTokenBalances
//     .filter(postB => postB.owner && walletStore.has(postB.owner))
//     .flatMap(postB => {
//         if (!postB.owner || !walletStore.has(postB.owner)) return; // its not associated with ant of the users walles

//         const preB = preBalancesMap.get(postB.accountIndex);
//         if (!preB || preB.uiTokenAmount.amount !== postB.uiTokenAmount.amount) {
//             return [{ walletAddress: postB.owner, mint: postB.mint, amountInfo: postB.uiTokenAmount }];
//         }

//         return [];
//     });

// return { walletNativeBalanceUpdates, walletTokenBalanceUpdates };

const addNewTokenToUserWallet = async (userId: string, userWalletAddress: Address, tokenMint: Address) => {
    // hot tokens metadata from redis
    // else take the metadata from the tokens table if not found, add new token meta to tokens table
    // const res = solanaRpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    // console.log("token meta", util.inspect(res, { depth: null }));

    console.log("adding new token to db...")
    if (tokenMint === "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") {
        const [token] = await sql`
        WITH inserted AS (
            INSERT INTO tokens (chain_id, address, symbol, name, decimals, deployed_at)  
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

        console.log(token)
        return {
            token_address: token.address,
            symbol: token.symbol,
            name: token.name,
        };
    }
    return null;
    // const res = await solanaRpc.getAccountInfo(tokenMint, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    // const meta = await fetchMetadataFromSeeds(solanaRpc, { mint: tokenMint })
    // console.log(util.inspect(meta, { depth: null }));
    // return;
}

const getUpdatedTokenBalances = async (
    changes: WalletTokenBalanceChange[],
    userWalletTokensMeta: Map<string, {
        token_address: string,
        symbol: string,
        name: string,
    }>,
    handleNewWallet: (newAccData: any) => Promise<void>,
): Promise<UserWalletUpdate> => {
    if (!changes) throw new Error("NO_CHANGES");

    const tokenUpdates = new Map<Address, TokenUpdate[]>();

    for (const change of changes) {
        console.log("change for wa", change);
        if (!tokenUpdates.has(change.walletAddress)) {
            tokenUpdates.set(change.walletAddress, []);
        }

        const userTokenUpdates = tokenUpdates.get(change.walletAddress)!;
        if (change.mint === "11111111111111111111111111111111") {
            userTokenUpdates.push({
                mint: "11111111111111111111111111111111",
                symbol: "SOL",
                name: "Solana",
                balance: {
                    amount: stringifiedBigInt(change.amountInfo.amount),
                    decimals: 9,
                    uiAmount: change.amountInfo.uiAmount, // create a function
                }
            });
        } else {
            const tokenMeta = userWalletTokensMeta.get(change.mint) ?? await handleNewWallet(change.mint)
            console.log(tokenMeta)
            if (!tokenMeta) {
                console.error("token meta missing")
                continue;
            }

            userTokenUpdates.push({
                mint: tokenMeta.token_address,
                symbol: tokenMeta.symbol,
                name: tokenMeta.name,
                balance: {
                    amount: change.amountInfo.amount,
                    decimals: change.amountInfo.decimals,
                    uiAmount: change.amountInfo.uiAmount,
                }
            });
        }
    }

    return {
        type: "wallet-update",
        chain: "SOLANA",
        tokenUpdates: [...tokenUpdates].map(([walletAddress, updates]) => ({ walletAddress, updates })),
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

}

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
    const allUserWalletTokens = await sql`
        SELECT w.address as wallet_address, 
        COALESCE(json_agg(
            json_build_object(
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
        GROUP BY w.address
        `;

    console.log(util.inspect(allUserWalletTokens, { depth: null }))

    const allUserTokens = allUserWalletTokens.reduce((tokenMap, wt) => {
        for (const token of wt.token_list) {
            tokenMap.set(token.token_address, {
                token_address: token.token_address,
                symbol: token.symbol,
                name: token.name,
            });
        }
        return tokenMap;
    }, new Map());

    if (!allUserWalletTokens) {
        console.error("subscribeUserWallets: wallet not found")
        return subsClient.pushErrAndDrop(userId, topic, { code: "NO_TOKENS_FOUND" });
    }

    const msg: UserWalletInit = {
        type: "init",
        snapshot: allUserWalletTokens, // {chainId, oken_address, symbol, name, decimals}[]
    }
    subsClient.push(userId, topic, msg);

    allUserWalletTokens.forEach(wt => startTrackingSolanaAddress(wt.wallet_address, async (txData: GetTranscationResult) => {
        // note: callbackHandler is used once per signature to update all the wallets inside of it
        // updates are for the UI only, dont store ata accounts or balances
        const changes = parseTxBalancesChanges(txData); // can have multple updates from different wallets
        const walletUpdateMsg = await getUpdatedTokenBalances(changes, allUserTokens, (newTokenData: any) => addNewTokenToUserWallet(userId, wt.wallet_address, newTokenData)); // updates is a list of userTokens with updates balances

        return subsClient.push(userId, topic, walletUpdateMsg);
    }));
}


