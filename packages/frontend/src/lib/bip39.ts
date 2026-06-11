import { createKeyPairFromBytes, createKeyPairSignerFromBytes, getAddressFromPublicKey, type KeyPairSigner } from "@solana/kit";
import { getSeed, wipeSeed } from "./seed"
import { HDKey } from '@scure/bip32'

const deriveSolanaWallet = async (seed: Buffer, idx: number): Promise<string> => {
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey) {
        throw new Error("Failed to derive key");
    }

    return await createKeyPairFromBytes(child.privateKey).then(kp => getAddressFromPublicKey(kp.publicKey))
}

const deriveSolanaKepair = async (seed: Buffer, idx: number): Promise<KeyPairSigner> => {
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey) {
        throw new Error("Failed to derive key");
    }

    return await createKeyPairSignerFromBytes(child.privateKey);
}

export const deriveWallet = (chainId: string, nextDerivationIdx: number) => {
    try {
        const seed = getSeed()
        if (!seed) throw new Error("Vault is locked");

        switch (chainId) {
            case "501": return deriveSolanaWallet(seed, nextDerivationIdx);
            default: throw new Error("unsupported chain");
        }
    } finally {
        wipeSeed()
    }
}

export const deriveKeypair = (chainId: string, nextDerivationIdx: number) => {
    try {
        const seed = getSeed()
        if (!seed) throw new Error("Vault is locked");

        switch (chainId) {
            case "501": return deriveSolanaKepair(seed, nextDerivationIdx);
            default: throw new Error("unsupported chain");
        }
    } finally {
        wipeSeed()
    }
}


