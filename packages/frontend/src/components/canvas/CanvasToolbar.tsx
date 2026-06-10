import { memo } from "react";
import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore";

export const CanvasToolbar = memo(() => {
    const activeTool = useToolStore(s => s.activeTool);
    const setActiveTool = useToolStore(s => s.setActiveTool);

    return (
        <Panel position='top-center'>
            <div className="flex gap-2 bg-transparent rounded-xl shadow-md px-3 py-2">
                {(["hand", "cursor", "add", "arrow", "remove"]).map((tool) => (
                    <button
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={
                            `px-3 py-1 rounded-lg text-sm font-medium transition-colors ${activeTool === tool
                                ? 'bg-black text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >{
                            tool === "cursor" ? "↖" : tool === "hand" ? "✋" : tool === "add" ? "+" : tool === "arrow" ? "->" : "x"}</button>
                ))}
            </div>
        </Panel>
    )
});
