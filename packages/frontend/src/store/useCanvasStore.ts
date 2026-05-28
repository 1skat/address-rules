import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Node } from "@xyflow/react"

type Tool = "hand" | "cursor" | "add" | "remove";

type CanvasStore = {
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
    nodes: Node[];
    setNodes: (nodes: Node[]) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            nodes: [],
            activeTool: "hand",
            setActiveTool: (tool) => set({ activeTool: tool }),
            setNodes: (nodes) => set({ nodes }), // update the eniter array
            addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
            removeNode: (id: string) => set((s) => ({ nodes: s.nodes.filter(n => n.id !== id) })),
        }),
        { name: "canvas-store" }
    )
);
