import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { subsClient } from "@/ws_client.js";
import { address, type Address, type Lamports, type Signature, type StringifiedBigInt, type StringifiedNumber } from "@solana/kit";
import util from "util";

// get the wallets
// trigget update ack per wallet
type WalletData = { // only data relevant to the client
    walletAddress: string,
}

type UserWalletInit = {
    type: "init",
    snapshot: Map<string, WalletData>
}
type TokenUpdate = {
    chain: "SOLANA" | "ETHEREUM";
    symbol: string;
    name: string;
    tokenAddress: string,
    balance: string,
    decimals: number,
}
type UserWalletUpdate = {
    type: "update"
    walletAddress: string;
    tokenUpdates: TokenUpdate[];
}

type AccountBalancenData = {
    accountAddress: Address,
    balance: string,
}
const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

type BalanceChanges = {
    walletNativeBalanceUpdates: { accountAddress: Address, balance: string }[];
    walletTokenBalanceUpdates?: {
        walletAddress: Address;
        mint: Address;
        amount: Readonly<{
            amount: StringifiedBigInt;
            decimals: number;
            uiAmount: number | null;
            uiAmountString: StringifiedNumber;
        }>;
    }[];
}
const parseTxBalancesChanges = (data: GetTranscationResult): BalanceChanges => {
    const { meta, transaction } = data;
    if (!meta || !transaction) throw new Error("no meta/transaction found, handle the err over ws");

    const walletNativeBalanceUpdates = transaction.message.accountKeys
        .map((ak, idx) => ({ ak, idx }))
        .filter(({ ak, idx }) => walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx])
        .map(({ ak, idx }) => ({ accountAddress: ak.pubkey, balance: meta.postBalances[idx]!.toString() }));

    if (!meta.postTokenBalances) return { walletNativeBalanceUpdates }; // no changes for tokens

    const preBalancesMap = new Map(
        meta.preTokenBalances?.map(b => [b.accountIndex, b]) ?? [],
    );
    const walletTokenBalanceUpdates = meta.postTokenBalances
        .filter(postB => postB.owner && walletStore.has(postB.owner))
        .flatMap(postB => {
            if (!postB.owner || !walletStore.has(postB.owner)) return; // its not associated with ant of the users walles

            const preB = preBalancesMap.get(postB.accountIndex);
            if (!preB || preB.uiTokenAmount.amount !== postB.uiTokenAmount.amount) {
                return [{ walletAddress: postB.owner, mint: postB.mint, amount: postB.uiTokenAmount }];
            }

            return [];
        });

    return { walletNativeBalanceUpdates, walletTokenBalanceUpdates };
}

const addNewTokenToUserWallet = async (userId: string, userWalletAddress: Address, newAccData: AccountBalancenData): Promise<void> => {
    console.log("add new token to user wallet:", newAccData);
    // hot tokens metadata from redis
    // else take the metadata from the tokens table if not found, add new token meta to tokens table
    // const res = solanaRpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    // console.log("token meta", util.inspect(res, { depth: null }));
    return
}

// const getUpdatedTokenBalances = (
//     changes: AccountBalancenData[],
//     userWalletTokens: any[],
//     onNewTokenHandler: (newAccData: AccountBalancenData) => Promise<void>,
// ): TokenUpdate[] => {
//     if (!changes) throw new Error("NO_CHANGES")

//     const updateTokens: TokenUpdate[] = [];
//     changes.forEach(change => {
//         // either wallet address (native SOL) or ata 
//         const accAddress = userWalletTokens.find(wt => wt.wallet_address === change.accountAddress);
//         if (!token) {
//             onNewTokenHandler(change)
//             // might wanna add the field to changes to identify wether to add a new token to the table
//             // e.g a new sig with usdc airdrop comes in, but usdc token isnt linked to wallets tabel of the userId
//             // but i dont have the ctx so i dont know which user we're fetching wallets for -> pass closure from the ack function
//             return;
//         }
//         updateTokens.push({
//             chain: "SOLANA",
//             symbol: token.symbol,
//             name: token.name,
//             tokenAddress: token.address,
//             balance: change.balance,
//             decimals: token.decimals,
//         });
//     })

//     return updateTokens;
// }

export const ackSubscribedUserWallets = async (userId: string, topic: string): Promise<void> => {
    // subsClient.sub(userId, subId, "wallet_updates");

    // inner join cuz each wallet has >= 1 token (SOL)
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

    if (!allUserWalletTokens) {
        console.error("subscribeUserWallets: wallet not found")
        return subsClient.pushErrAndDrop(userId, topic, { code: "WALLETS_NOT_FOUND" });
    }

    const msg: UserWalletInit = {
        type: "init",
        snapshot: allUserWalletTokens,
    }
    subsClient.push(userId, topic, msg);

    allUserWalletTokens.forEach(wt => startTrackingSolanaAddress(wt.wallet_address, (txData: GetTranscationResult): void => {
        console.log("entered the data handler", util.inspect(txData, { depth: null }));
        // note: callbackHandler is used once per signature to update all the wallets inside of it
        // updates are for the UI only, dont store ata accounts or balances
        const changes = parseTxBalancesChanges(txData); // can have multple updates from different wallets
        console.log("balance changes:", changes)
        // const tokenUpdates = getUpdatedTokenBalances(changes, wt, (newTokenData: TokeBalancenData) => addNewTokenToUserWallet(userId, wt.wallet_address, newTokenData)); // updates is a list of userTokens with updates balances
        // console.log("token updates:", tokenUpdates)

        // const msg: UserWalletUpdate = { 
        //     type: "update",
        //     walletAddress: wt.wallet_address,
        //     tokenUpdates,
        // }

        // return subsClient.push(userId, topic, msg);
    }));
}

// export const updateUserWalletState = async (userId: string, subId: string, data: any) => {

// }


