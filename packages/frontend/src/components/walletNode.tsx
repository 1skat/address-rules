import React, { memo, useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { archiveWallet } from "../api/client";
import SolLogo from "../assets/chains/solana.svg"

export const WalletNode = memo(({ id, data }: NodeProps) => {
    const removeNode = useCanvasStore(s => s.removeNode);
    const activeTool = useCanvasStore(s => s.activeTool);

    const onMouseEnter = useCallback(async (ev: React.MouseEvent) => {
        if (activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        await archiveWallet(id)
        removeNode(id);
    }, [activeTool, id, removeNode]);

    return (
        <div onMouseEnter={onMouseEnter} className="flex items-center gap-2 bg-gray-400 p-2 shadow border">
            <Handle
                type="source"
                position={Position.Left}
                style={{ top: '35%' }}
            >
                <div className="absolute" style={{ transform: 'translate(-25%, -50%)' }}>
                    <svg width="7" height="8" viewBox="0 0 7 8">
                        <rect x="0" y="0" width="5" height="8" />
                        <polygon points="5,0 7,4 5,8" />
                    </svg>
                </div>
            </Handle>
            <img src={SolLogo} alt="SOL" className="w-4 h-4" />
            {data.label}
            <Handle
                className="w-1 h-2 bg-green-600"
                type="source"
                position={Position.Right}
            />
        </div>
    );
});
