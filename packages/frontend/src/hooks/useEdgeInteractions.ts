import React, { useCallback, useRef } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection, Edge } from "@xyflow/react";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);
    const setSelectedEdge = useCanvasStore(s => s.setSelectedEdge)
    const edgeReconnectSuccessful = useRef(false);

    const onEdgeMouseEnter = useCallback(async (ev: React.MouseEvent, edge: Edge) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeEdge(edge.id);
    }, [removeEdge]);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
        if (useToolStore.getState().activeTool !== "cursor") return;

        setSelectedEdge(edge)
    }, [setSelectedEdge])

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
            setSelectedEdge(null)
            return;
        }

        setSelectedEdge(edge)
        edgeReconnectSuccessful.current = true;
    }, [removeEdge, setSelectedEdge])

    return { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd, onEdgeClick }
}
