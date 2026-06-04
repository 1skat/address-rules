import { getSeed } from "./seed"
import { HDKey } from '@scure/bip32'
import { Keypair } from "@solana/web3.js";

const deriveSolanaeWallet = (idx: number): string => {
    const seed = getSeed();
    if (!seed) throw new Error("Vault is locked");

    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey) {
        throw new Error("Failed to derive key");
    }

    return Keypair.fromSeed(child.privateKey).publicKey.toBase58();
}

export const deriveWallet = (chainId: string, nextDerivationIdx: number) => {
    if (chainId === "501") {
        return deriveSolanaeWallet(nextDerivationIdx)
    }
}


