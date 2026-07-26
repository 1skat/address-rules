import { useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { useToolStore } from "../store/useToolStore";
import type { Node, XYPosition } from "@xyflow/react";
import { archiveWallet, createWallet } from "../api/client";
import { tryCatchAsync } from "../utils/try-catch";
import { stringifiedBigInt } from "@solana/kit";


export const useNodeInteraction = () => {
    const addNode = useCanvasStore(s => s.addNode);
    const removeNode = useCanvasStore(s => s.removeNode);

    const onNodeMouseEnter = useCallback(async (ev: React.MouseEvent, node: Node) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        const [, errArchivingWallet] = await tryCatchAsync(() => archiveWallet(node.id));
        if (errArchivingWallet) return;

        removeNode(node.id);
    }, [removeNode]);

    const addWalletNode = async (chainId: string, mousePos: XYPosition, alias: string | null) => {
        const newWallet = await createWallet(chainId, alias, mousePos);
        addNode({
            id: newWallet.id,
            type: "wallet",
            position: mousePos,
            data: {
                derivationIndex: newWallet.derivation_index,
                chainId: "501",
                address: newWallet.address,
                alias: newWallet.alias,
                selectedTokenId: "b5c3ff67-699c-4fb5-8544-ade0e09dbcea", // default to native if not found
                tokens: {
                    ["b5c3ff67-699c-4fb5-8544-ade0e09dbcea"]: {
                        tokenMeta: {
                            tokenId: "b5c3ff67-699c-4fb5-8544-ade0e09dbcea",
                            chainId: "501",
                            mint: "11111111111111111111111111111111",
                            symbol: "SOL",
                            name: "Solana",
                            decimals: 9,
                        },
                        balanceAmount: stringifiedBigInt("0"),
                        uiBalanceAmount: "0",
                    },
                    ["d473ea11-40d4-433c-8450-ea45152aff82"]: {
                        tokenMeta: {
                            tokenId: "d473ea11-40d4-433c-8450-ea45152aff82",
                            chainId: "501",
                            mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                            symbol: "USDC",
                            name: "USDC",
                            decimals: 6,
                        },
                        balanceAmount: stringifiedBigInt("0"),
                        uiBalanceAmount: "0",
                    }
                }
            },
        });
    }

    return { onNodeMouseEnter, addWalletNode }
}
