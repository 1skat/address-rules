import React, { memo, useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { archiveWallet } from "../api/client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
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
            <Handle type="source" position={Position.Left} id="left" />
            <img src={SolLogo} alt="SOL" className="w-4 h-4" />
            {data.label}
            <Handle type="source" position={Position.Right} id="right" />
        </div >
    );
    // return (
    //     <div onMouseEnter={onMouseEnter} className="flex items-center gap-2 bg-gray-400 p-2 shadow border">
    //         <Handle
    //             type="target"
    //             position={Position.Left}
    //             className="w-1 h-2.5"
    //             id="target-left"
    //             style={{ top: "50%" }}

    //         />
    //         <Handle
    //             type="source"
    //             position={Position.Left}
    //             className="w-1 h-2.5"
    //             id="source-left"
    //             style={{ top: "50%" }}

    //         />
    //         <img src={SolLogo} alt="SOL" className="w-4 h-4" />
    //         {data.label}
    //         <Handle
    //             type="target"
    //             position={Position.Right}
    //             className="w-1 h-2.5"
    //             id="target-right"
    //             style={{ top: "50%" }}

    //         />
    //         <Handle
    //             type="source"
    //             position={Position.Right}
    //             className="w-1 h-2.5"
    //             id="source-right"
    //             style={{ top: "50%" }}
    //         />
    //     </div >
    // )
});
