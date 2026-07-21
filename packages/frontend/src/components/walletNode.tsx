// import React, { memo, useCallback } from "react";
// import { useCanvasStore, type NodeWalletData } from "../store/useCanvasStore"
// import { archiveWallet } from "../api/client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import SolLogo from "../assets/chains/solana.svg"
import USDCLogo from "../assets/chains/usdc.svg"
// import { useToolStore } from "../store/useToolStore";
import { shortFormat } from "../lib/utils";
import { useCanvasStore, type NodeWalletData, type TokenMeta } from "../store/useCanvasStore";
import { memo } from "react";
// import { shortFormat } from "../lib/utils";

const exampleUserPortfolioStore: Record<string, TokenMeta> = {
    "0b94bf38-b88c-4867-8957-7143e0d86235": {
        tokenId: "0b94bf38-b88c-4867-8957-7143e0d86235",
        chainId: "501",
        mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
        iconURI: USDCLogo,
    },
    "14ce98ee-5006-4bc7-a360-1ff1b826892f": {
        tokenId: "14ce98ee-5006-4bc7-a360-1ff1b826892f",
        chainId: "501",
        mint: "11111111111111111111111111111111",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        iconURI: SolLogo,
    }
}

export const WalletNode = memo(({ id, data }: NodeProps) => {
    const setNodeSelectedMint = useCanvasStore(s => s.setNodeSelectedMint);
    const walletData = data as NodeWalletData;

    const walletTokens = walletData.tokens[walletData.selectedTokenId]

    return (
        <div className="flex items-center gap-2 bg-gray-400 p-2 shadow border">
            <Handle type="source" position={Position.Left} id="left" />
            <span>{walletTokens.uiBalanceAmount}</span>
            <img src={exampleUserPortfolioStore[walletData.selectedTokenId].iconURI} alt={walletTokens.tokenMeta.symbol} className="w-4 h-4" />
            <select value={walletData.selectedTokenId} onChange={(e) => setNodeSelectedMint(id, e.target.value)}>
                {Object.entries(exampleUserPortfolioStore).map(([ti, td]) => (
                    <option key={ti} value={ti}>{td.symbol}</option >
                ))}
            </select>
            {shortFormat(walletData.address)}
            <Handle type="source" position={Position.Right} id="right" />
        </div >
    );
});
