import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import { useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";

export const SendSolanaTxCard = () => {
    const activeTool = useToolStore(s => s.activeTool);
    const selectedEdge = useCanvasStore(s => s.selectedEdge);
    const nodes = useCanvasStore(s => s.nodes);
    const [amount, setAmount] = useState<number>(0);

    if (activeTool !== "cursor" || !selectedEdge) return null;

    const fromNode = nodes.find(n => n.id === selectedEdge.source);
    const toNode = nodes.find(n => n.id === selectedEdge.target);

    return (
        <Panel className="absolute left">
            <div className="border p-2">
                <label className="flex gap-1">
                    <span>Amount</span>
                    <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                </label>
                <button className="bg-amber-500 p-1">Send</button>
                <hr className="m-2" />
                <div className="bg-amber-200">
                    <label className="flex gap-1">
                        <span>From</span>
                        <span>{fromNode?.data.address}</span>
                    </label>
                    <label className="flex gap-1">
                        <span>To</span>
                        <span>{toNode?.data.address}</span>
                    </label>
                </div>
            </div>
        </Panel>
    )
}
