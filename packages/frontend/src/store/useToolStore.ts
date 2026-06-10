import { create } from "zustand"
import { persist } from "zustand/middleware"

type Tool = "hand" | "cursor" | "arrow" | "add" | "remove";

type ToolStore = {
    activeTool: Tool;
    setActiveTool: (tool: Tool) => void;
}

export const useToolStore = create<ToolStore>()(
    persist(
        (set) => ({
            activeTool: "hand",
            nodes: [],
            edges: [],
            setActiveTool: (tool) => set({ activeTool: tool }),
        }),
        { name: "tool-store" }
    )
);
