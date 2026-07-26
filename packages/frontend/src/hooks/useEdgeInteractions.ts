import React, { useCallback, useRef } from "react";
import { useCanvasStore, type EdgeTransactionDataV3, type TransactionEdge } from "../store/useCanvasStore";
import { useToolStore } from "../store/useToolStore";
import type { Connection } from "@xyflow/react";
import { createEdge } from "../api/client";
import { stringifiedBigInt } from "@solana/kit";

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

    const addConnectionEdge = async (connection: Connection) => {
        const txEdge: EdgeTransactionDataV3 = {
            chainId: "501",
            selectedTokenId: "b5c3ff67-699c-4fb5-8544-ade0e09dbcea", // cache in localstorage or index db
            tokens: {
                ["b5c3ff67-699c-4fb5-8544-ade0e09dbcea"]: {
                    state: "draft",
                    tokenMeta: {
                        tokenId: "b5c3ff67-699c-4fb5-8544-ade0e09dbcea",
                        chainId: "501",
                        mint: "11111111111111111111111111111111",
                        symbol: "SOL",
                        name: "Solana",
                        decimals: 9,
                    },
                    totalAmount: stringifiedBigInt("0"),
                    uiTotalAmount: "0",
                }
            }
        }

        const id = addConnection(connection, txEdge); // from zustand
        try {
            await createEdge(id, connection, txEdge)
        } catch (err) {
            console.error(err);
            edgeReconnectSuccessful.current = false;
            removeEdge(id);
            return;
        }
    }

    return { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd, onEdgeClick, addConnectionEdge }
}
