import React, { useCallback, useRef } from "react";
import { useCanvasStore, type EdgeTransactionData, type TransactionEdge } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection } from "@xyflow/react";
import { stringifiedBigInt } from "@solana/kit";

export const useEdgeInteraction = () => {
    const removeEdge = useCanvasStore(s => s.removeEdge);
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);
    const setSelectedEdgeId = useCanvasStore(s => s.setSelectedEdgeId);
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

    const addConnection = (connection: Connection, data: EdgeTransactionData) => {
        const edgeTxData = {
            chainId: "501",
            selectedMint: "11111111111111111111111111111111",
            totals: {
                "11111111111111111111111111111111": {
                    tokenMeta: {
                        mint: "11111111111111111111111111111111",
                        symbol: "SOL",
                        name: "Solana",
                        decimals: 9,
                    },
                    amount: stringifiedBigInt("0"),
                    uiAmount: "0",
                }
            }
        }
    }

    return { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd, onEdgeClick }
}
