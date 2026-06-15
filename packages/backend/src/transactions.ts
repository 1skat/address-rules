import { Router } from 'express'
import { tryCatchAsync } from './utils/try-catch.js';
import { authenticate } from './middleware/authenticate.js';
import sql from "@/internal/db.js"
import { sendAndConfirmSolanaTransaction, solanaRpc } from './internal/rpc.js';
import { getSignatureFromTransaction } from '@solana/kit';
import { wsClient } from './internal/ws_client.js';

const txRouter = Router();

txRouter.get("/", authenticate, async (req, res) => {
    const [txs] = await sql`SELECT FROM wallets `
});

// txRouter.post("/send", authenticate, async (req, res) => {
//     const { signedTx } = req.body;
//     if (!signedTx) {
//         return res.status(400).json("Signed transaction missing");
//     }

//     const uws = wsClient.get(req.user.sub)
//     if (!uws) return;

//     uws.send(JSON.stringify({ type: "tx:pending" }));
//     res.status(202).end()

//     res.status(202).json({ status: "pending" });

//     const [_, txErr] = await tryCatchAsync(() => sendAndConfirmSolanaTransaction(signedTx, { commitment: "finalized" }));
//     if (txErr) {
//         return res.status(400).json(`Failed: ${txErr}`);
//     }
//     const signature = getSignatureFromTransaction(signedTx); // already finalized

//     return res.status(200).json({ signature });
// });

txRouter.get("/blockhash", async (req, res) => {
    // check lru -> redis -> chain
    const { value } = await solanaRpc.getLatestBlockhash().send();

    return res.status(200).json({
        blockhash: value.blockhash,
        lastValidBlockHeight: value.lastValidBlockHeight.toString(),
    });
})

export default txRouter;
