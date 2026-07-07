import { address, appendTransactionMessageInstructions, createTransactionMessage, getBase64EncodedWireTransaction, lamports, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners, type Address, type KeyPairSigner } from "@solana/kit"
import { getTransferSolInstruction } from '@solana-program/system';
import { getBlockhash } from "../api/client"
import type { TokenMeta } from "../store/useCanvasStore";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Instruction } from "@solana/kit";

export const buildTransferInstruction = async (fromAddress: KeyPairSigner, toAddress: Address, amount: bigint, tokenMeta: TokenMeta): Promise<Instruction[]> => {
    if (tokenMeta.mint === "11111111111111111111111111111111") {
        return [getTransferSolInstruction({
            amount: lamports(amount),
            destination: toAddress,
            source: fromAddress,
        })];
    }

    const [senderATA] = await findAssociatedTokenPda({
        mint: address(tokenMeta.mint),
        owner: fromAddress.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });
    const [recipientATA] = await findAssociatedTokenPda({
        mint: address(tokenMeta.mint),
        owner: toAddress,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    return [
        getCreateAssociatedTokenIdempotentInstruction({
            payer: fromAddress,
            ata: recipientATA,
            owner: toAddress,
            mint: address(tokenMeta.mint),
        }),
        getTransferCheckedInstruction({
            source: senderATA,
            mint: address(tokenMeta.mint),
            destination: recipientATA,
            authority: fromAddress,
            amount,
            decimals: tokenMeta.decimals,
        }),
    ];
}

export const buildSolanaTransaction = async (fromAddress: KeyPairSigner, ixs: Instruction[]) => {
    const latestBlockhash = await getBlockhash();

    const txMessage = pipe(
        createTransactionMessage({ version: 0 }), // version
        tx => setTransactionMessageFeePayer(fromAddress.address, tx), // fee payer
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx), // blockhash
        tx => appendTransactionMessageInstructions(ixs, tx)
    );
    const signedTx = await signTransactionMessageWithSigners(txMessage);

    return {
        // wireTx: getBase64EncodedWireTransaction(signedTx),
        // blockhash: signedTx.lifetimeConstraint.blockhash,
        // lastValidBlockHeight: signedTx.lifetimeConstraint.lastValidBlockHeight.toString(),
        wireTx: getBase64EncodedWireTransaction(signedTx),
        blockhash: signedTx.lifetimeConstraint,
        lastValidBlockHeight: signedTx.lifetimeConstraint.toString(),
    }
}

