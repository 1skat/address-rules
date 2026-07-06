import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"

export type EdgeTransactionData = {
    chain: "SOLANA" | "ETHEREUM";
    tokenMeta: {
        mint: string,
        symbol: string,
        name: string,
        iconURI?: string,
        decimals: number,
    }
}
export type TransactionEdge = Edge<EdgeTransactionData>;

type CanvasStore = {
    nodes: Node[];
    setNodes: (change: any) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    removeEdge: (id: string) => void;
    edges: TransactionEdge[];
    selectedEdge: TransactionEdge | null;
    setSelectedEdge: (edge: TransactionEdge | null) => void;
    setEdges: (change: any) => void;
    addConnection: (connection: Connection) => void;
    reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => void;
    setEdgeCurrency: (edgeId: string, data: EdgeTransactionData) => void;
}


export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            nodes: [],
            edges: [],
            selectedEdge: null,
            setNodes: (change) => set((s) => ({ nodes: applyNodeChanges(change, s.nodes) })), // update the eniter array
            addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
            removeNode: (id: string) => set((s) => ({
                nodes: s.nodes.filter(n => n.id !== id),
                edges: s.edges.filter(e => e.source !== id && e.target !== id)
            })),
            removeEdge: (id: string) => {
                console.log("removing edge:", id)
                set((s) => ({ edges: s.edges.filter(e => e.id !== id) }))
            },
            addConnection: (connection, data: EdgeTransactionData = {
                chain: "SOLANA",
                tokenMeta: {
                    mint: "11111111111111111111111111111111",
                    symbol: "SOL",
                    name: "Solana",
                    decimals: 9,
                }
            }/*default*/) => {
                console.log("adding connection:", connection);
                set((s) => ({
                    edges: addEdge<TransactionEdge>({
                        ...connection,
                        type: "wallet",
                        data,
                    }, s.edges)
                }))
            },
            setEdges: (change) => set((s) => {
                console.log("set edge change:", change)
                return { edges: applyEdgeChanges(change, s.edges) }
            }),
            setSelectedEdge: (edge: TransactionEdge | null) => {
                console.log("selected edge:", edge)
                return set({ selectedEdge: edge })
            },
            reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => set((s) => ({
                edges: rfReconnectEdge(oldEdge, newConnection, s.edges)
            })),
            setEdgeCurrency: (edgeId: string, data: EdgeTransactionData) => {
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId ? { ...e, data } : e),
                }));
            },
        }),
        {
            name: "canvas-store",
            partialize: (s) => ({ nodes: s.nodes, edges: s.edges })
        }
    ),
);
