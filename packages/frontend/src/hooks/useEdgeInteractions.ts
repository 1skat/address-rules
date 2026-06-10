import { useCallback, useRef } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection, Edge } from "@xyflow/react";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);
    const edgeReconnectSuccessful = useRef(false);

    const onEdgeMouseEnter = useCallback(async (ev: React.MouseEvent, edge: Edge) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeEdge(edge.id);
    }, [removeEdge]);

    const onReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false;
    }, []);

    const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        edgeReconnectSuccessful.current = true;
        reconnectEdge(oldEdge, newConnection);
    }, [reconnectEdge])

    const onReconnectEnd = useCallback((_, edge: Edge) => {
        if (!edgeReconnectSuccessful.current) {
            removeEdge(edge.id)
        }

        edgeReconnectSuccessful.current = true;
    }, [removeEdge])

    return { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd }
}
