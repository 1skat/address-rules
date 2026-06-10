import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"

type CanvasStore = {
    nodes: Node[];
    setNodes: (change: any) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    removeEdge: (id: string) => void;
    edges: Edge[];
    selectedEdge: Edge | null;
    setSelectedEdge: (edge: Edge | null) => void;
    setEdges: (change: any) => void;
    addConnection: (connection: Connection) => void;
    reconnectEdge: (oldEdge: Edge, newConnection: Connection) => void;
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
            addConnection: (connection) => set((s) => ({
                edges: addEdge({
                    ...connection,
                    type: "wallet",
                }, s.edges)
            })),
            setEdges: (change) => set((s) => ({ edges: applyEdgeChanges(change, s.edges) })),
            setSelectedEdge: (edge: Edge | null) => set({ selectedEdge: edge }),
            reconnectEdge: (oldEdge: Edge, newConnection: Connection) => set((s) => ({
                edges: rfReconnectEdge(oldEdge, newConnection, s.edges)
            })),
        }),
        {
            name: "canvas-store",
            partialize: (s) => ({ nodes: s.nodes, edges: s.edges })
        }

    )
);
