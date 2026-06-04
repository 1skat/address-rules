import { memo } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { Panel } from "@xyflow/react";

export const CanvasToolbar = memo(() => {
    const activeTool = useCanvasStore(s => s.activeTool);
    const setActiveTool = useCanvasStore(s => s.setActiveTool);

    return (
        <Panel position='top-center'>
            <div className="flex gap-2 bg-transparent rounded-xl shadow-md px-3 py-2">
                {(["hand", "cursor", "add", "remove"]).map((tool) => (
                    <button
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={
                            `px-3 py-1 rounded-lg text-sm font-medium transition-colors ${activeTool === tool
                                ? 'bg-black text-white'
                                : 'text-gray-500 hover:bg-gray-100'
                            }`}
                    >{
                            tool === "cursor" ? "↖" : tool === "hand" ? "✋" : tool === "add" ? "+" : "x"}</button>
                ))}
            </div>
        </Panel>
    )
});
