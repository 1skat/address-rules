import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"
import { stringifiedBigInt, type Signature, type StringifiedBigInt } from "@solana/kit";

export type TokenMeta = {
    mint: string;
    symbol: string;
    name: string;
    iconURI?: string;
    decimals: number;
}

export type EdgeTransactionData = {
    chainId: "501" | "60";
    selectedMint: string;
    totals: Record<string, {
        tokenMeta: TokenMeta;
        amount: StringifiedBigInt;
        uiAmount: string;
    }>
}
export type TxData = {
    status: "draft" | "pending" | "processed";
    signature: Signature;
    amount: StringifiedBigInt;
    uiAmount: string;
}
export type EdgeTransactionDataV2 = {
    chainId: "501" | "60";
    selectedMint: string;
    isDraft: boolean;
    tokens: Record<string, {
        tokenMeta: TokenMeta;
        totalAmount: StringifiedBigInt;
        uiTotalAmount: string;
        transactions: Record<string, TxData>;
    }>;
}
export type TransactionEdge = Edge<EdgeTransactionDataV2>;

export type CurrencyUpdateData = {
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
    addConnection: (connection: Connection, edgeData: EdgeTransactionDataV2) => string;
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
            addConnection: (connection, data: EdgeTransactionDataV2) => {
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
                console.log("set edge change:", change)
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
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId ? accumulateTotals(e, data) : e),
                }));
            },
        }),
        {
            name: "canvas-store",
            partialize: (s) => ({ nodes: s.nodes, edges: s.edges })
        }
    ),
);


const accumulateTotals = (e: TransactionEdge, data: CurrencyUpdateData): TransactionEdge => {
    const { mint, tokenMeta, amountInfo } = data;
    const prev = e.data?.tokens[mint]
    const newAmount = (prev ? BigInt(prev.totalAmount) : BigInt(0)) + BigInt(amountInfo.amount);
    const newUi = (prev ? parseFloat(prev.uiTotalAmount) : 0) + parseFloat(amountInfo.uiAmount);

    return {
        ...e,
        data: {
            ...e.data,
            selectedMint: mint,
            tokens: {
                ...e.data?.tokens,
                [mint]: {
                    tokenMeta, totalAmount: stringifiedBigInt(newAmount.toString()), uiTotalAmount: newUi.toString(),
                }
            }
        }
    }
};
