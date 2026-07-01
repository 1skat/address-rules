import { startTrackingSolanaAddress, walletStore } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import { solanaRpc } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { subsClient } from "@/ws_client.js";
import { address, type Address, type Signature } from "@solana/kit";
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
type UserWalletUpdate = {
    type: "update"
    tokenUpdates: [
        {
            chain: "SOLANA" | "ETHEREUM";
            symbol: string;
            name: string;
            tokenAddress: string,
            balance: BigInt,
            decimals: number,
        }
    ]
}
// todo: pull the type where its jsonParse so i have the ParsedAccount array
const _rpcResultHint = solanaRpc.getTransaction('' as Signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 });
type GetTranscationResult = NonNullable<Awaited<ReturnType<typeof _rpcResultHint['send']>>>;
// type GetTranscationResult = NonNullable<Awaited<ReturnType<ReturnType<typeof solanaRpc.getTransaction>['send']>>>;

type WalletStateData = {
    userId: string;
    subId: string;
}

const parseTxBalancesChanges = (data: GetTranscationResult) => {
    const { meta, transaction } = data;
    if (!meta || !transaction) {
        console.error("no meta/transaction found, handle the err over ws")
        return;
    }

    return transaction.message.accountKeys
        .map((ak, idx) => ({ ak, idx }))
        .filter(({ ak, idx }) => ak.writable && walletStore.has(ak.pubkey) && meta.preBalances[idx] !== meta.postBalances[idx])
        .map(({ ak, idx }) => ({ tokenAddress: ak.pubkey, balance: meta.postBalances[idx] }));
}

const addTokenMetaToUserWallet = async (tokenAddress: Address) => {
    const res = solanaRpc.getAccountInfo(tokenAddress, { commitment: "confirmed", encoding: "jsonParsed" }).send();
    console.log("token meta", util.inspect(res, { depth: null }));

    return
}

const updateUserWallets = (changes: any, userTokens: any): UserWalletUpdate => {
    if (!changes) throw new Error("NO_CHANGES")

    return {
        type: "update",
        tokenUpdates: changes
            .map(change => {
                // const token = userTokens.filter(t => t.address === change.tokenAddress)
                // ? t.address
                // : 
                const token = userTokens.find(t => t.address === change.tokenAddress);
                if (!token) {
                    addTokenMetaToUserWallet(t.address);
                    return;
                }

                return {
                    chain: "SOLANA",
                    symbol: token.symbol,
                    name: token.name,
                    tokenAddress: token.address,
                    balance: change.balance,
                    decimals: token.decimals,
                }
            }),
    }
}

// for ata tokens pull extra data from the db
// update balances of wallets are both in tx data AND WalletStateStore, add updated balances to the tokenudpates arary

export const subscribeUserWallets = async (userId: string, subId: string): void => {
    subsClient.sub(userId, subId, "wallet_updates");

    const userWallets = await sql`
        SELECT w.address as wallet_address, t.address as token_address, t.symbol, t.name, t.decimals
        FROM wallets w
        JOIN wallet_tokens wt ON wt.wallet_id = w.id
        JOIN tokens t ON wt.token_id = t.id
        WHERE w.account_id = ${userId}
        AND w.archived = false
        `;

    console.log("res", userWallets);
    return;
    if (!userWallets) {
        return subsClient.pushErrAndDrop(userId, subId, { code: "WALLETS_NOT_FOUND" });
    }

    const msg: UserWalletInit = {
        type: "init",
        snapshot: userWallets,
    }
    subsClient.push(userId, "wallet_updates", msg);

    userWallets.forEach(w => startTrackingSolanaAddress(w.address, (txData: GetTranscationResult): void => {
        const changes = parseTxBalancesChanges(txData);
        const updates = updateUserWallets(changes, userTokens);

        updates.tokenUpdates.forEach(u => {
            // await sql`UPDATE tokens `
        })

        return subsClient.push(userId, "wallet_updates", updates);
    }));
}

export const updateUserWalletState = async (userId: string, subId: string, data: any) => {

}


