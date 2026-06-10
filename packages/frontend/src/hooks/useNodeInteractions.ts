import { useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { useToolStore } from "../store/useToolStore";
import type { Node } from "@xyflow/react";

export const useNodeInteraction = () => {
    const removeNode = useCanvasStore(s => s.removeNode);

    const onNodeMouseEnter = useCallback(async (ev: React.MouseEvent, node: Node) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeNode(node.id);
    }, [removeNode]);

    return { onNodeMouseEnter }
}
