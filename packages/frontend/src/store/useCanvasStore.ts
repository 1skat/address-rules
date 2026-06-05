import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, type Edge, type Node } from "@xyflow/react"

type Tool = "hand" | "cursor" | "add" | "remove";

type CanvasStore = {
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
    nodes: Node[];
    setNodes: (change: any) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    edges: Edge[];
    setEdges: (change: any) => void;
    addConnection: (connection: any) => void;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            activeTool: "hand",
            nodes: [],
            edges: [],
            setActiveTool: (tool) => set({ activeTool: tool }),
            setNodes: (change) => set((s) => ({ nodes: applyNodeChanges(change, s.nodes) })), // update the eniter array
            addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
            removeNode: (id: string) => set((s) => ({
                nodes: s.nodes.filter(n => n.id !== id),
                edges: s.edges.filter(e => e.source !== id && e.target !== id)
            })),
            addConnection: (connection) => set((s) => ({
                edges: addEdge({
                    ...connection,
                    type: "wallet",
                }, s.edges)
            })),
            setEdges: (change) => set((s) => ({ edges: applyEdgeChanges(change, s.edges) })),
        }),
        { name: "canvas-store" }
    )
);
