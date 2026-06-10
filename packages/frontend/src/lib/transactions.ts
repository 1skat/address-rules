import { appendTransactionMessageInstruction, createTransactionMessage, getBase64EncodedWireTransaction, lamports, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, type Address, type KeyPairSigner } from "@solana/kit"
import { getTransferSolInstruction } from '@solana-program/system';
import { getBlockhash } from "../api/client"

export const buildSolanaTransaction = async (fromAddress: KeyPairSigner, toAddress: Address, amountLamports: bigint) => {
    const latestBlockhash = await getBlockhash()

    const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        tx => setTransactionMessageFeePayer(fromAddress.address, tx),
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        tx => appendTransactionMessageInstruction(
            getTransferSolInstruction({
                amount: lamports(amountLamports),
                destination: toAddress,
                source: fromAddress,
            }),
            tx,
        )
    );

    const signedTx = await signTransactionMessageWithSigners(txMessage);

    return getBase64EncodedWireTransaction(signedTx);
}
