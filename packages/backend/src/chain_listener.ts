import { solanaStream, solanaRpc } from "./internal/rpc.js";
import { address, type Address, type Signature } from "@solana/kit";
import util from "util";


export const walletStore = new Map<Address, AbortController>();
const processedSignatures = new Set<Signature>(); // set a ttl

export const handleSignature = async (signature: Signature) => { // todo: make handle handle error with {code, message}
    if (processedSignatures.has(signature)) return;
    processedSignatures.add(signature);

    return await solanaRpc.getTransaction(signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
}

export const startTrackingSolanaAddress = async (solanaAddress: string, dataHandler: (txData: any) => void) => {
    console.log("start tracking", solanaAddress)
    const walletAddress = address(solanaAddress); // can fail catch errs
    if (walletStore.has(walletAddress)) return;

    const controller = new AbortController();
    walletStore.set(walletAddress, controller);

    const transactionLogs = await solanaStream
        .logsNotifications({ mentions: [walletAddress] }, { commitment: "confirmed" })
        .subscribe({ abortSignal: controller.signal });

    for await (const txLog of transactionLogs) {
        const sig = txLog.value.signature; // get a map -> to dedup, probably gonna set it inside the sendTransaction
        console.log("signature", sig)
        const txData = await handleSignature(sig)
        if (!txData) {
            console.log("already processed")
            continue;
        }

        dataHandler(txData);
    }
}
