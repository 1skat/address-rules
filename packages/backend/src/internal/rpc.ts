import { cfg } from "@/config.js"
import { createSolanaRpc } from '@solana/kit';

const solanaRpc = createSolanaRpc(cfg.solana_rpc_endpoint);

export default solanaRpc;
