import { Router } from 'express';
import solanaRpc from './internal/rpc.js';
import { tryCatchAsync } from './utils/try-catch.js';
import { blockhash } from '@solana/kit';
import { sign } from 'node:crypto';

const txRouter = Router();

txRouter.post("/send", async (req, res) => {
    const { signedTx } = req.body;
    console.log("body:", signedTx)
    const [signature, txErr] = await tryCatchAsync(() => solanaRpc.sendTransaction(signedTx, { encoding: "base64" }).send());
    if (txErr) {
        return res.status(400).json(`Failed to send transaction: ${txErr}`);
    }

    return res.status(200).json({ signature });
});

// жизнь посмотрит на сколько сильно ты этого хочешь
txRouter.get("/blockhash", async (req, res) => {
    // check lru -> redis -> chain
    const { value } = await solanaRpc.getLatestBlockhash().send();

    return res.status(200).json({
        blockhash: value.blockhash,
        lastValidBlockHeight: value.lastValidBlockHeight.toString(),
    });
})

export default txRouter;



