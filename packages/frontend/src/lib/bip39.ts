import { getSeed } from "./seed"
import { HDKey } from '@scure/bip32'
import { Keypair } from "@solana/web3.js";

export const deriveSolanaeWallet = (idx: number): Keypair => {
    const seed = getSeed();
    if (!seed) throw new Error("Vault is locked");

    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey) {
        throw new Error("Failed to derive key");
    }

    return Keypair.fromSeed(child.privateKey);
}
