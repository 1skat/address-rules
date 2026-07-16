import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"
import { stringifiedBigInt, type StringifiedBigInt } from "@solana/kit";

type OrderState = "EXECUTING" | "EXECUTION_FAILED" | "FILLED";

export type TokenMeta = {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    iconURI?: string;
}

export type EdgeTransactionData = {
    chainId: "501" | "60";
    selectedMint: string;
    state: "draft" | "pending" | "processed";
    tokens: Record<string, {
        tokenMeta: TokenMeta;
        totalAmount: StringifiedBigInt;
        uiTotalAmount: string;
    }>;
}
export type TransactionEdge = Edge<EdgeTransactionData>;

export type CurrencyUpdateData = {
    signature: string;
    mint: string;
    tokenMeta: TokenMeta;
    amountInfo: {
        amount: StringifiedBigInt;
        uiAmount: string;
    }
}

type CanvasStore = {
    nodes: Node[];
    setNodes: (change: any) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    removeEdge: (id: string) => void;
    edges: TransactionEdge[];
    // selectedEdge: TransactionEdge | null;
    // setSelectedEdge: (edge: TransactionEdge | null) => void;
    selectedEdgeId: string | null;
    setSelectedEdgeId: (edgeId: string | null) => void;
    // getSelectedEdge: () => TransactionEdge | null;
    setEdges: (change: any) => void;
    setEdgeState: (edgeId: string, status: OrderState) => void;
    addConnection: (connection: Connection, edgeData: EdgeTransactionData) => string;
    reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => void;
    setEdgeCurrency: (edgeId: string, data: CurrencyUpdateData) => void;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            nodes: [],
            edges: [],
            // selectedEdge: null,
            selectedEdgeId: null,
            setSelectedEdgeId: (edgeId: string | null) => {
                return set({ selectedEdgeId: edgeId });
            },
            // getSelectedEdge: () => get().edges.find(e => e.id === get().selectedEdgeId) ?? null,
            setNodes: (change) => set((s) => ({ nodes: applyNodeChanges(change, s.nodes) })), // update the eniter array
            // addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
            addNode: (node) => {
                console.log("adding node", node);
                set((s) => ({ nodes: [...s.nodes, node] }))
            },
            removeNode: (id: string) => set((s) => ({
                nodes: s.nodes.filter(n => n.id !== id),
                edges: s.edges.filter(e => e.source !== id && e.target !== id)
            })),
            removeEdge: (id: string) => {
                console.log("removing edge:", id)
                set((s) => ({ edges: s.edges.filter(e => e.id !== id) }))
            },
            addConnection: (connection, data: EdgeTransactionData) => {
                const id = crypto.randomUUID();
                set((s) => ({
                    edges: addEdge<TransactionEdge>({
                        ...connection,
                        id,
                        type: "wallet",
                        data,
                    }, s.edges)
                }));

                return id;
            },
            setEdges: (change) => set((s) => {
                return { edges: applyEdgeChanges(change, s.edges) }
            }),
            // setSelectedEdge: (edge: TransactionEdge | null) => {
            //     console.log("selected edge:", edge)
            //     return set({ selectedEdge: edge })
            // },
            reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => {
                console.log(oldEdge.id)
                set((s) => ({
                    edges: rfReconnectEdge(oldEdge, newConnection, s.edges)
                }))
            },
            setEdgeCurrency: (edgeId: string, data: CurrencyUpdateData) => {
                const { mint, tokenMeta, amountInfo } = data;
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId && e.data
                        ? {
                            ...e,
                            data: {
                                ...e.data,
                                selectedMint: mint,
                                tokens: {
                                    ...e.data?.tokens,
                                    [mint]: {
                                        tokenMeta, totalAmount: stringifiedBigInt(amountInfo.amount), uiTotalAmount: amountInfo.uiAmount,
                                    }
                                }
                            }
                        } : e)
                }))
            },
            setEdgeState: (edgeId: string, txState: OrderState) => {
                set((s) => {
                    return {
                        edges: s.edges.map((e) => e.id === edgeId && e.data ? {
                            ...e, data: {
                                ...e.data,
                                status: txState === "EXECUTING" ? "pending" : txState === "FILLED" ? "processed" : "draft",
                            }
                        } : e)
                    }
                })
            },
        }),
        {
            name: "canvas-store",
            partialize: (s) => ({ nodes: s.nodes, edges: s.edges })
        }
    ),
);


// const accumulateTotals = (e: TransactionEdge, data: CurrencyUpdateData): TransactionEdge => {
//     console.log(`accumulate totals for ${e.id}`, data);
//     const { mint, tokenMeta, amountInfo } = data;
//     const prev = e.data?.tokens[mint] // null on new
//     const newAmount = (prev ? BigInt(prev.totalAmount) : BigInt(0)) + BigInt(amountInfo.amount);
//     const newUi = (prev ? parseFloat(prev.uiTotalAmount) : 0) + parseFloat(amountInfo.uiAmount);

//     return {
//         ...e /*TranasctionEdge*/,
//         data: {
//             ...e.data,
//             selectedMint: mint,
//             tokens: {
//                 ...e.data?.tokens,
//                 [mint]: {
//                     tokenMeta, totalAmount: stringifiedBigInt(newAmount.toString()), uiTotalAmount: newUi.toString(),
//                 },
//             }
//         }
//     }
// };
