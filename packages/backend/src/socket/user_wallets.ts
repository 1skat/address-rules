import sql from "@/internal/db.js";
import type { Context } from "@/stream.js";

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
}

export const subscribeUserWallets = async (ctx: Context, subId: string) => {
    ctx.subsClient.sub(ctx.userId, subId, "WALLETS")

    const userWallets = await sql`SELECT * FROM wallets WHERE account_id = ${ctx.userId} AND archived = false`;
    if (!userWallets) {
        return ctx.subsClient.pushErrAndDrop(ctx.userId, subId, { code: "WALLETS_NOT_FOUND" });
    }

    const msg: UserWalletInit = {
        type: "init",
        snapshot: userWallets,
    }
    return ctx.subsClient.push(ctx.userId, "WALLETS", msg);
}


