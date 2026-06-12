import { createKeyPairFromPrivateKeyBytes, createKeyPairSignerFromBytes, createKeyPairSignerFromPrivateKeyBytes, getAddressFromPublicKey, type Address, type KeyPairSigner } from "@solana/kit";
import { getSeed } from "./seed"
import { HDKey } from '@scure/bip32'

const deriveSolanaWallet = async (seed: Buffer, idx: number): Promise<Address> => {
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey) {
        throw new Error("Failed to derive key");
    }

    return await createKeyPairFromPrivateKeyBytes(child.privateKey).then(kp => getAddressFromPublicKey(kp.publicKey))
}

const deriveSolanaKepair = async (seed: Buffer, idx: number): Promise<KeyPairSigner> => {
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(`m/44'/501'/${idx}'/0`);

    if (!child.privateKey || !child.publicKey) {
        throw new Error("Failed to derive key");
    }

    return await createKeyPairSignerFromPrivateKeyBytes(child.privateKey); // needs pubkey + privkey
}

// const deriveSolanaKepairV2 = async (seed: Buffer, idx: number): Promise<CryptoKeyPair> => {
//     const root = HDKey.fromMasterSeed(seed);
//     const child = root.derive(`m/44'/501'/${idx}'/0`);

//     if (!child.privateKey) {
//         throw new Error("Failed to derive key");
//     }

//     return await createKeyPairFromPrivateKeyBytes(child.privateKey); // needs pubkey + privkey
// }

export const deriveWallet = (chainId: string, nextDerivationIdx: number) => {
    const seed = getSeed()
    if (!seed) throw new Error("Vault is locked");

    switch (chainId) {
        case "501": return deriveSolanaWallet(seed, nextDerivationIdx);
        default: throw new Error("unsupported chain");
    }
}

export const deriveKeypair = (chainId: string, nextDerivationIdx: number) => {
    const seed = getSeed()
    if (!seed) throw new Error("Vault is locked");

    switch (chainId) {
        case "501": {
            return deriveSolanaKepair(seed, nextDerivationIdx);
        }
        default: throw new Error("unsupported chain");
    }
}
