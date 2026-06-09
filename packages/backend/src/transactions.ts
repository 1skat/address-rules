import { Router } from 'express';
import solanaRpc from './internal/rpc.js';
import { tryCatchAsync } from './utils/try-catch.js';

const txRouter = Router();

txRouter.post("/send", async (req, res) => {
    const { signedTx } = req.body;
    const [signature, txErr] = await tryCatchAsync(() => solanaRpc.sendTransaction(signedTx).send());
    if (txErr) {
        return res.status(400).json("Failed to send transcation");
    }

    return res.status(200).json({ signature });
});

txRouter.get("/blockhash", async (req, res) => {
    // check lru -> redis -> chain
    const { value } = await solanaRpc.getLatestBlockhash().send();

    return res.status(200).json({ blockhashData: value });
})



