import { solanaStream, solanaRpc } from "./internal/rpc.js";
import { address, type Address, type Signature } from "@solana/kit";
import util from "util";

type WalletStateData = {
    controller: AbortController;
    userId: string;
    subId: string;
}

const walletStore = new Map<Address, AbortController>();
const sigsStore = new Set<Signature>(); // set a ttl

export const startTrackingAddress = async (solanaAddress: string, logHandler: (walletAddres: Address, data: any) => void) => {
    const walletAddress = address(solanaAddress); // can fail catch errs
    if (walletStore.has(walletAddress)) return;

    const controller = new AbortController();
    walletStore.set(walletAddress, controller);

    const transactionLogs = await solanaStream
        .logsNotifications({ mentions: [walletAddress] }, { commitment: "confirmed" })
        .subscribe({ abortSignal: controller.signal });

    for await (const txLog of transactionLogs) {
        const sig = txLog.value.signature; // get a map -> to dedup, probably gonna set it inside the sendTransaction

        if (sigsStore.has(sig)) {
            console.log(walletAddress, "skipped")
            continue;
        }
        const res = await solanaRpc.getTransaction(txLog.value.signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
        logHandler(walletAddress, res);
    }
}

// export const initWalletStateTracker = async () => {  // runs at the start of the server
//     await Promise.all(
//         [...walletStore.entries().map(async ([walletAddress, subData]) => {
//             const accountNotifications = await solanaStream
//                 .accountNotifications(walletAddress, { commitment: "finalized" })
//                 .subscribe({ abortSignal: subData.controller.signal });

//             for await (const notification of accountNotifications) {

//             }
//         })]
//     )
// }

// const startTracking = async (address: Address, subData: WalletStateData) => {
//     const accountNotifications = await solanaStream
//         .accountNotifications(address, { commitment: "finalized" })
//         .subscribe({ abortSignal: subData.controller.signal });

//     for await (const notification of accountNotifications) {

//         updateUserWallet(subData.userId,)
//     }
// }
