import { startTrackingAddress } from "@/chain_listener.js";
import sql from "@/internal/db.js";
import type { solanaRpc } from "@/internal/rpc.js";
import type { Context } from "@/stream.js";
import { subsClient } from "@/ws_client.js";

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
            decimals: 9
        }
    ]
}

type GetTranscationResult = NonNullable<Awaited<ReturnType<ReturnType<typeof solanaRpc.getTransaction>['send']>>>;

const parseUpdateBalance = (walletAddress: string, data: GetTranscationResult) => {

}

export const subscribeUserWallets = async (userId: string, subId: string) => {
    subsClient.sub(userId, subId, "wallet_updates");

    const userWallets = await sql`SELECT address FROM wallets WHERE account_id = ${userId} AND archived = false`;
    if (!userWallets) {
        return subsClient.pushErrAndDrop(userId, subId, { code: "WALLETS_NOT_FOUND" });
    }

    userWallets.forEach(w => startTrackingAddress(userId, subId, w.address));

    const msg: UserWalletInit = {
        type: "init",
        snapshot: userWallets,
    }
    return subsClient.push(userId, "wallet_updates", msg);
}

export const updateUserWalletState = async (userId: string, subId: string, data: any) => {

    // const msg = {
    //     type: 
    // }
}


