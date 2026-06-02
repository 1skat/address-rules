import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Node, Viewport } from "@xyflow/react"

type Tool = "hand" | "cursor" | "add" | "remove";

type CanvasStore = {
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
    nodes: Node[];
    setNodes: (nodes: Node[]) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    viewport: Viewport;
    setViewport: (viewport: Viewport) => void;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            nodes: [],
            activeTool: "hand",
            viewport: { x: 0, y: 0, zoom: 1 },
            setActiveTool: (tool) => set({ activeTool: tool }),
            setNodes: (nodes) => set({ nodes }), // update the eniter array
            addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
            removeNode: (id: string) => set((s) => ({ nodes: s.nodes.filter(n => n.id !== id) })),
            setViewport: (viewport) => set({ viewport }),
        }),
        { name: "canvas-store" }
    )
);
