import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import React, { useState } from "react";
import { useCanvasStore, type TokenMeta } from "../../store/useCanvasStore";
import { toSmallestUnit, toUiAmount } from "../../lib/utils";
import { buildSolanaTransaction, buildTransferInstruction } from "../../lib/transactions";
import { deriveKeypair } from "../../lib/bip39";
import { address, stringifiedBigInt } from "@solana/kit";
import { AddressLabel } from "../AddressLabel";
import { sendSolanaTransaction, subscribeOrderStatus } from "../../api/ws";


const exampleUserPortfolioStore: Record<string, TokenMeta> = {
    "501:4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": {
        mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
    },
    "501:11111111111111111111111111111111": {
        mint: "11111111111111111111111111111111",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
    }
}

export const SendSolanaTxCard = React.memo(() => {
    const activeTool = useToolStore(s => s.activeTool);
    const selectedEdge = useCanvasStore(s => s.edges.find(e => e.id === s.selectedEdgeId));
    // const setEdgeCurrency = useCanvasStore(s => s.setEdgeCurrency);
    const setEdgeSelectedMint = useCanvasStore(s => s.setEdgeSelectedMint);
    const nodes = useCanvasStore(s => s.nodes);
    const [amount, setAmount] = useState<bigint>(0n);
    const [pending, setPending] = useState(false);
    const [err, setErr] = useState<Error | null>(null);

    if (activeTool !== "cursor" || !selectedEdge) return null;

    const fromNode = nodes.find(n => n.id === selectedEdge.source);
    const toNode = nodes.find(n => n.id === selectedEdge.target);

    const handlerCurrencyChange = (tokenMint: string) => {
        return setEdgeSelectedMint(selectedEdge.id, "501", tokenMint);
    }

    const onClickHandler = async () => {
        try {
            setPending(true)
            if (amount <= 0n) {
                setErr(new Error("Invalid amount"));
                return;
            };
            if (!selectedEdge.data) return;

            const fromAddressKpSigner = await deriveKeypair(fromNode?.data.chainId, fromNode?.data.derivationIndex)
            const toAddress = address(toNode?.data.address);

            const tokenData = exampleUserPortfolioStore[`501:${selectedEdge.data.selectedMint}`];
            if (!tokenData) {
                console.error(`token data for ${selectedEdge.data.selectedMint} not found`);
                return
            }
            const ixs = await buildTransferInstruction(fromAddressKpSigner, toAddress, amount, tokenData);
            const tx = await buildSolanaTransaction(fromAddressKpSigner, ixs); // get a signature here locally
            const { orderId } = await sendSolanaTransaction(tx, selectedEdge.id);
            console.log("requested", orderId);
            subscribeOrderStatus(orderId, selectedEdge.id);
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
                    <input type="number" className="border" placeholder="0" onChange={(e) => {
                        if (!selectedEdge.data) {
                            console.error("edge data not found");
                            return;
                        }
                        const decimals = exampleUserPortfolioStore[`501:${selectedEdge.data.selectedMint}`]?.decimals;
                        if (!decimals) return;

                        const val = toSmallestUnit(e.target.value, decimals);
                        if (val) setAmount(val);
                    }} />
                    <select value={selectedEdge.data?.selectedMint} onChange={(e) => handlerCurrencyChange(e.target.value)}>
                        {Object.values(exampleUserPortfolioStore).map(td => (
                            <option key={td.mint} value={td.mint}>{td.symbol}</option>)
                        )}
                    </select>
                </label>
                <button className="bg-amber-500 hover:bg-amber-600 p-1 " disabled={pending} onClick={onClickHandler}>Send</button>
                {err && <p className="bg-red-700"> {err.message}</p>}
                <hr className="m-2" />
                <div className="bg-amber-200">
                    <label className="flex gap-1">
                        <span>From</span>
                        <AddressLabel address={fromNode?.data.address} />
                    </label>
                    <label className="flex gap-1">
                        <span>To</span>
                        <AddressLabel address={toNode?.data.address} />
                    </label>
                </div>
            </div>
        </Panel >
    )
});
