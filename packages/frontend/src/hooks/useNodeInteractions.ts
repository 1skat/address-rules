import { useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { useToolStore } from "../store/useToolStore";
import type { Node } from "@xyflow/react";
import { archiveWallet } from "../api/client";
import { tryCatchAsync } from "../utils/try-catch";

export const useNodeInteraction = () => {
    const removeNode = useCanvasStore(s => s.removeNode);

    const onNodeMouseEnter = useCallback(async (ev: React.MouseEvent, node: Node) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        const [, errArchivingWallet] = await tryCatchAsync(() => archiveWallet(node.id));
        if (errArchivingWallet) return;

        removeNode(node.id);
    }, [removeNode]);

    return { onNodeMouseEnter }
}
