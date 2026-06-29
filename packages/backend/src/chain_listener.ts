import WebSocket from "ws";
import { solanaStream } from "./internal/rpc.js";
import { address } from "@solana/kit";

const wallets = [
    address("HQ4Lg6qUWsure4kaazDD5gEjM2duKBkNQxZM2KSsskRQ"), address("61KyCJeeT3ct9jpXWam9EB7UXhDggWBw6hHCRcHLo2FH"),
];

export const initWalletStateTracker = async () => {
    const controllers = new Map(wallets.map(w => [w, new AbortController()]));

    await Promise.all(
        wallets.map(async wallet => {
            const controller = controllers.get(wallet);
            if (!controller) return;

            const accountNotifications = await solanaStream
                .accountNotifications(wallet, { commitment: "finalized" })
                .subscribe({ abortSignal: controller.signal });

            for await (const notification of accountNotifications) {
                console.log(`notif [${wallet.toString()}]:`, notification);
            }
        })
    )


}



