import { memo, useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"

export const WalletNode = memo(({ id, data }) => {
    const removeNode = useCanvasStore(s => s.removeNode);
    const activeTool = useCanvasStore(s => s.activeTool);

    const handleMouseEnter = useCallback(() => {
        if (activeTool !== "remove") return;
        removeNode(id);
    }, [activeTool, id, removeNode]);

    return (
        <div onMouseEnter={handleMouseEnter} className="bg-gray-400 rounded-lg p-3 shadow border">
            {data.label}
        </div>
    );
})
