import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import { useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { shortFormat, solToLamport } from "../../lib/utils";
import { buildSolanaTransaction } from "../../lib/transactions";
import { deriveKeypair } from "../../lib/bip39";
import { address } from "@solana/kit";
import { sendSolanaTx } from "../../api/client";

export const SendSolanaTxCard = () => {
    const activeTool = useToolStore(s => s.activeTool);
    const selectedEdge = useCanvasStore(s => s.selectedEdge);
    const nodes = useCanvasStore(s => s.nodes);
    const [amount, setAmount] = useState<bigint>(0n);
    const [pending, setPending] = useState(false);
    const [err, setErr] = useState<Error | null>(null);

    if (activeTool !== "cursor" || !selectedEdge) return null;

    const fromNode = nodes.find(n => n.id === selectedEdge.source);
    const toNode = nodes.find(n => n.id === selectedEdge.target);

    // const onClickHandler = async () => {
    //     try {
    //         setPending(true)
    //         if (amount <= 0n) return;

    //         const fromAddressKpSigner = await deriveKeypair(fromNode?.data.chainId, fromNode?.data.derivationIndex)
    //         const toAddress = address(toNode?.data.address)

    //         const tx = await buildSolanaTransaction(fromAddressKpSigner, toAddress, amount)
    //         const sig = await sendSolanaTx(tx)
    //     } catch (err) {
    //         setErr(err)

    //     } finally {
    //         setPending(false)
    //     }
    // }

    return (
        <Panel className="absolute left">
            <div className="border p-2">
                <label className="flex gap-1">
                    <span>Amount</span>
                    <input type="number" onChange={(e) => setAmount(solToLamport(e.target.value))} />
                </label>
                <button className="bg-amber-500 hover:bg-amber-600 p-1 " disabled={pending}>Send</button>
                <hr className="m-2" />
                <div className="bg-amber-200">
                    <label className="flex gap-1">
                        <span>From</span>
                        <span>{shortFormat(fromNode?.data.address)}</span>
                    </label>
                    <label className="flex gap-1">
                        <span>To</span>
                        <span>{shortFormat(toNode?.data.address)}</span>
                    </label>
                </div>
            </div>
        </Panel>
    )
}
