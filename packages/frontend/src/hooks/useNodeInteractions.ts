import { useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { useToolStore } from "../store/useToolStore";
import type { Node, XYPosition } from "@xyflow/react";
import { archiveWallet, createWallet } from "../api/client";
import { tryCatchAsync } from "../utils/try-catch";


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
                address: newWallet.address,
                alias: newWallet.alias,
                derivationIndex: newWallet.derivation_index,
                chainId: newWallet.chain_id,
            },
        });
    }

    return { onNodeMouseEnter, addWalletNode }
}
