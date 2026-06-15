import { cfg } from "@/config.js"
import { createSolanaRpc, createSolanaRpcSubscriptions, sendAndConfirmTransactionFactory } from '@solana/kit';

export const solanaRpc = createSolanaRpc(cfg.solana_rpc_http);
export const solanaStream = createSolanaRpcSubscriptions(cfg.solana_rpc_ws);
export const sendAndConfirmSolanaTransaction = sendAndConfirmTransactionFactory({ rpc: solanaRpc, rpcSubscriptions: solanaStream });

// export default sendAndConfirmTransaction;
