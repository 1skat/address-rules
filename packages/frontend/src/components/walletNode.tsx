import React, { memo, useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import type { NodeProps } from "@xyflow/react";

export const WalletNode = memo(({ id, data }: NodeProps) => {
    const removeNode = useCanvasStore(s => s.removeNode);
    const activeTool = useCanvasStore(s => s.activeTool);

    const onMouseEnter = useCallback((ev: React.MouseEvent) => {
        if (activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        removeNode(id);
    }, [activeTool, id, removeNode]);

    return (
        <div onMouseEnter={onMouseEnter} className="bg-gray-400 rounded-lg p-3 shadow border">
            {data.label}
        </div>
    );
});
