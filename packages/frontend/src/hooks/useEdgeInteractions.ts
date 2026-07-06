import React, { useCallback, useRef } from "react";
import { useCanvasStore, type TransactionEdge } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection } from "@xyflow/react";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);
    const setSelectedEdge = useCanvasStore(s => s.setSelectedEdge);
    const edgeReconnectSuccessful = useRef(false);

    const onEdgeMouseEnter = useCallback(async (ev: React.MouseEvent, edge: TransactionEdge) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeEdge(edge.id);
    }, [removeEdge]);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: TransactionEdge) => {
        if (useToolStore.getState().activeTool !== "cursor") return;

        setSelectedEdge(edge)
    }, [setSelectedEdge])

    const onReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false;
    }, []);

    const onReconnect = useCallback((oldEdge: TransactionEdge, newConnection: Connection) => {
        edgeReconnectSuccessful.current = true;
        reconnectEdge(oldEdge, newConnection);
    }, [reconnectEdge])

    const onReconnectEnd = useCallback((_, edge: TransactionEdge) => {
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
