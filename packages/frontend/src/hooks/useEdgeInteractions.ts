import React, { useCallback, useRef } from "react";
import { useCanvasStore, type EdgeTransactionDataV2, type TransactionEdge } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection } from "@xyflow/react";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);
    const setSelectedEdgeId = useCanvasStore(s => s.setSelectedEdgeId);
    const addConnection = useCanvasStore(s => s.addConnection);
    const edgeReconnectSuccessful = useRef(false);

    const onEdgeMouseEnter = useCallback(async (ev: React.MouseEvent, edge: TransactionEdge) => {
        if (useToolStore.getState().activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeEdge(edge.id);
    }, [removeEdge]);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: TransactionEdge) => {
        if (useToolStore.getState().activeTool !== "cursor") return;

        setSelectedEdgeId(edge.id);
        console.log(edge);
        // setSelectedEdge(edge)
    }, [setSelectedEdgeId]);

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
            setSelectedEdgeId(null)
            return;
        }

        setSelectedEdgeId(edge.id)
        edgeReconnectSuccessful.current = true;
    }, [removeEdge, setSelectedEdgeId])

    const addConnectionEdge = (connection: Connection) => {
        const txEdge: EdgeTransactionDataV2 = {
            chainId: "501",
            selectedMint: "11111111111111111111111111111111",
            isDraft: true,
            tokens: {},
        }

        const id = addConnection(connection, txEdge); // from zustand
        console.log("id:", id);
    }

    return { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd, onEdgeClick, addConnectionEdge }
}
