import { solanaStream, solanaRpc } from "./internal/rpc.js";
import { address, type Address, type Signature } from "@solana/kit";
import util from "util";
import type { GetTranscationResult } from "./socket/user_wallets.js";


export const walletStore = new Map<Address, { id: string, address: string, controller: AbortController }>();
const processedSignatures = new Set<Signature>(); // set a ttl to avoid memory leaks

export const handleSignature = async (signature: Signature) => { // todo: make handle handle error with {code, message}
    if (processedSignatures.has(signature)) return;
    processedSignatures.add(signature);

    return await solanaRpc.getTransaction(signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }).send();
}

export const startTrackingSolanaAddress = async (wId: string, wAddress: string, dataHandler: (txData: GetTranscationResult) => Promise<void>) => {
    console.log("start tracking", wAddress)
    const walletAddress = address(wAddress); // can fail catch errs
    if (walletStore.has(walletAddress)) return;

    const controller = new AbortController();
    walletStore.set(walletAddress, { id: wId, address: walletAddress, controller });

    const transactionLogs = await solanaStream
        .logsNotifications({ mentions: [walletAddress] }, { commitment: "confirmed" })
        .subscribe({ abortSignal: controller.signal });

    for await (const txLog of transactionLogs) {
        const sig = txLog.value.signature;
        const txData = await handleSignature(sig)
        if (!txData) {
            console.log("already processed")
            continue;
        }

        await dataHandler(txData);
    }
}

export const stopTrackingSolanaAddress = (address: Address): void => {
    const data = walletStore.get(address);
    if (!data) {
        console.warn(`stopTracking: ${address} not found, skipping`);
        return;
    }

    data.controller.abort();
    walletStore.delete(address);
}
