import { appendTransactionMessageInstruction, createTransactionMessage, getBase64EncodedWireTransaction, lamports, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, type Address, type KeyPairSigner } from "@solana/kit"
import { getTransferSolInstruction } from '@solana-program/system';
import { getBlockhash } from "../api/client"

export const buildSolanaTransaction = async (fromAddress: KeyPairSigner, toAddress: Address, amountLamports: bigint) => {
    const latestBlockhash = await getBlockhash();
    console.log("bh", latestBlockhash.blockhash);
    console.log("fee payer:", fromAddress.address, typeof fromAddress.address);

    const txMessage = pipe(
        createTransactionMessage({ version: 0 }), // version
        tx => setTransactionMessageFeePayer(fromAddress.address, tx), // fee payer
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx), // blockhash
        tx => appendTransactionMessageInstruction( // 
            getTransferSolInstruction({
                amount: lamports(amountLamports),
                destination: toAddress,
                source: fromAddress,
            }),
            tx,
        )
    );
    const signedTx = await signTransactionMessageWithSigners(txMessage);

    return {
        wireTx: getBase64EncodedWireTransaction(signedTx),
        blockhash: signedTx.lifetimeConstraint.blockhash,
        lastValidBlockHeight: signedTx.lifetimeConstraint.lastValidBlockHeight.toString(),
    }
}
