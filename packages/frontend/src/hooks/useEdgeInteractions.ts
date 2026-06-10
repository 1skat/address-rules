import { useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Edge } from "@xyflow/react";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);

    const onEdgeMouseEnter = useCallback(async (ev: React.MouseEvent, edge: Edge) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeEdge(edge.id);
    }, [removeEdge]);

    return { onEdgeMouseEnter }
}
