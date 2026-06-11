import React, { memo, useCallback } from "react";
import { useCanvasStore } from "../store/useCanvasStore"
import { archiveWallet } from "../api/client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import SolLogo from "../assets/chains/solana.svg"
import { useToolStore } from "../store/useToolStore";
import { shortFormat } from "../lib/utils";

export const WalletNode = memo(({ id, data }: NodeProps) => {
    const removeNode = useCanvasStore(s => s.removeNode);
    const activeTool = useToolStore(s => s.activeTool);

    const onMouseEnterDelete = useCallback(async (ev: React.MouseEvent) => {
        if (activeTool !== "remove") return;
        if (ev.buttons !== 1) return;

        await archiveWallet(id)
        removeNode(id);
    }, [activeTool, id, removeNode]);

    return (
        <div onMouseEnter={onMouseEnterDelete} className="flex items-center gap-2 bg-gray-400 p-2 shadow border">
            <Handle type="source" position={Position.Left} id="left" />
            <img src={SolLogo} alt="SOL" className="w-4 h-4" />
            {shortFormat(data.address)}
            <Handle type="source" position={Position.Right} id="right" />
        </div >
    );
});
