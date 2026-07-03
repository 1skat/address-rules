import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { subsClient } from "@/ws_client.js";
import { address, type Address, type Lamports, type Signature } from "@solana/kit";
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
const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;

const parseTxBalancesChanges = (data: GetTranscationResult) => {
    const { meta, transaction } = data;
    if (!meta || !transaction) throw new Error("no meta/transaction found, handle the err over ws");

    return transaction.message.accountKeys
        .map((ak, idx) => ({ ak, idx }))
        .filter(({ ak, idx }) => ak.writable && meta.preBalances[idx] !== meta.postBalances[idx]) // do i need to filter to only tracked wallets?
        .map(({ ak, idx }) => ({ tokenAddress: ak.pubkey, balance: meta.postBalances[idx]!.toString() }));
}

const addNewTokenToUserWallet = async (userId: string, tokenAddress: Address): Promise<void> => {
    // hot tokens metadata from redis
    // else take the metadata from the tokens table if not found, add new token meta to tokens table
    const res = solanaRpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    console.log("token meta", util.inspect(res, { depth: null }));

    return
}

const getUpdatedTokenBalances = (
    changes: { tokenAddress: Address, balance: string }[],
    userTokens: any[],
    onNewTokenHandler: (userId: string, tokenAddress: Address) => Promise<void>,
): TokenUpdate[] => {
    if (!changes) throw new Error("NO_CHANGES")

    const updateTokens: TokenUpdate[] = [];
    changes.forEach(change => {
        const token = userTokens.find(t => t.token_address === change.tokenAddress);
        if (!token) {
            // might wanna add the field to changes to identify wether to add a new token to the table
            // e.g a new sig with usdc airdrop comes in, but usdc token isnt linked to wallets tabel of the userId
            // but i dont have the ctx so i dont know which user we're fetching wallets for
            return;
        }
        updateTokens.push({
            chain: "SOLANA",
            symbol: token.symbol,
            name: token.name,
            tokenAddress: token.address,
            balance: change.balance,
            decimals: token.decimals,
        });
    })

    return updateTokens;
}

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
        // note: callbackHandler is used once per signature to update all the wallets inside of it
        // updates are for the UI only, dont store ata accounts or balances
        const changes = parseTxBalancesChanges(txData); // can have multple updates from different wallets
        console.log("Changes:", changes)
        const tokenUpdates = getUpdatedTokenBalances(changes, wt.token_list, () => addNewTokenToUserWallet(userId, wt.wallet_address)); // updates is a list of userTokens with updates balances
        console.log("token updates:", tokenUpdates)

        const msg: UserWalletUpdate = { // todo create a map of types for push
            type: "update",
            walletAddress: wt.wallet_address,
            tokenUpdates,
        }

        return subsClient.push(userId, topic, msg);
    }));
}

// export const updateUserWalletState = async (userId: string, subId: string, data: any) => {

// }


