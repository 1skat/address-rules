import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import { useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { solToLamport } from "../../lib/utils";
import { buildSolanaTransaction } from "../../lib/transactions";
import { deriveKeypair } from "../../lib/bip39";
import { address } from "@solana/kit";
import { AddressLabel } from "../AddressLabel";
import { sendSolanaTransaction, subscribeOrderStatus } from "../../api/ws";

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

    const onClickHandler = async () => {
        try {
            setPending(true)
            if (amount <= 0n) {
                setErr(new Error("Invalid amount"));
                return;
            };

            const fromAddressKpSigner = await deriveKeypair(fromNode?.data.chainId, fromNode?.data.derivationIndex)
            const toAddress = address(toNode?.data.address)

            const tx = await buildSolanaTransaction(fromAddressKpSigner, toAddress, amount) // get a signature here locally
            const { orderId } = await sendSolanaTransaction(tx)
            subscribeOrderStatus(orderId)
        } catch (err) {
            setErr(err)

        } finally {
            setPending(false)
        }
    }

    return (
        <Panel className="absolute left">
            <div className="border p-2">
                <label className="flex gap-1">
                    <span>Total</span>
                    <input type="number" className="border" placeholder="0" onChange={(e) => setAmount(solToLamport(e.target.value))} />
                </label>
                <button className="bg-amber-500 hover:bg-amber-600 p-1 " disabled={pending} onClick={onClickHandler}>Send</button>
                {err && <p className="bg-red-700"> {err.message}</p>}
                <hr className="m-2" />
                <div className="bg-amber-200">
                    <label className="flex gap-1">
                        <span>From</span>
                        <AddressLabel address={fromNode?.data.address} />
                        {/* <span>{shortFormat(fromNode?.data.address)}</span> */}
                    </label>
                    <label className="flex gap-1">
                        <span>To</span>
                        <AddressLabel address={toNode?.data.address} />
                        {/* <span>{shortFormat(toNode?.data.address)}</span> */}
                    </label>
                </div>
            </div>
        </Panel>
    )
}
