// import React, { memo, useCallback } from "react";
// import { useCanvasStore, type NodeWalletData } from "../store/useCanvasStore"
// import { archiveWallet } from "../api/client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import SolLogo from "../assets/chains/solana.svg"
import USDCLogo from "../assets/chains/usdc.svg"
// import { useToolStore } from "../store/useToolStore";
import { useCanvasStore, type NodeWalletData, type TokenMeta } from "../store/useCanvasStore";
import { memo } from "react";
import { shortFormat } from "../utils/utils";
// import { shortFormat } from "../lib/utils";

export const exampleUserPortfolioStore: Record<string, TokenMeta> = {
    "d473ea11-40d4-433c-8450-ea45152aff82": {
        tokenId: "d473ea11-40d4-433c-8450-ea45152aff82",
        chainId: "501",
        mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
        iconURI: USDCLogo,
    },
    "b5c3ff67-699c-4fb5-8544-ade0e09dbcea": {
        tokenId: "b5c3ff67-699c-4fb5-8544-ade0e09dbcea",
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
