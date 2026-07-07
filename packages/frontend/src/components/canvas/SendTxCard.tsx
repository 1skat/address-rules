import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import { useState } from "react";
import { useCanvasStore, type EdgeTransactionData } from "../../store/useCanvasStore";
import { toSmallestUnit } from "../../lib/utils";
import { buildSolanaTransaction, buildTransferInstruction } from "../../lib/transactions";
import { deriveKeypair } from "../../lib/bip39";
import { address, stringifiedBigInt } from "@solana/kit";
import { AddressLabel } from "../AddressLabel";
import { sendSolanaTransaction, subscribeOrderStatus } from "../../api/ws";

const exampleUserPortfolioStore: EdgeTransactionData[] = [ // remove later
    {
        chainId: "501",
        tokenMeta: {
            mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
            symbol: "USDC",
            name: "USDC",
            decimals: 6,
        },
        amountInfo: {
            amount: stringifiedBigInt(BigInt(0).toString()),
            uiAmount: "0",
        }
    },
    {
        chainId: "501",
        tokenMeta: {
            mint: "11111111111111111111111111111111",
            symbol: "SOL",
            name: "Solana",
            decimals: 9,
        },
        amountInfo: {
            amount: stringifiedBigInt(BigInt(0).toString()),
            uiAmount: "0",
        }
    }
];

export const SendSolanaTxCard = () => {
    const activeTool = useToolStore(s => s.activeTool);
    const selectedEdge = useCanvasStore(s => s.selectedEdge);
    const setEdgeCurrency = useCanvasStore(s => s.setEdgeCurrency);
    const nodes = useCanvasStore(s => s.nodes);
    const [amount, setAmount] = useState<bigint>(0n);
    const [pending, setPending] = useState(false);
    const [err, setErr] = useState<Error | null>(null);

    if (activeTool !== "cursor" || !selectedEdge) return null;

    const fromNode = nodes.find(n => n.id === selectedEdge.source);
    const toNode = nodes.find(n => n.id === selectedEdge.target);

    const handlerCurrencyChange = (tokenMint: string) => {
        const token = exampleUserPortfolioStore.find(t => t.tokenMeta.mint === tokenMint) // for evm add chainId comparison
        if (!token) return;
        setEdgeCurrency(selectedEdge.id, token);
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

            const ixs = await buildTransferInstruction(fromAddressKpSigner, toAddress, amount, selectedEdge.data.tokenMeta)
            const tx = await buildSolanaTransaction(fromAddressKpSigner, ixs) // get a signature here locally
            console.log("signedTX", tx);
            const { orderId } = await sendSolanaTransaction(tx);
            subscribeOrderStatus(orderId); // might hide it in sendSolanatranscation
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
                        const decimals = selectedEdge.data?.tokenMeta.decimals;
                        if (!decimals) return;
                        const val = toSmallestUnit(e.target.value, decimals);
                        if (val) setAmount(val);
                    }} />
                    <select value={selectedEdge.data?.tokenMeta.mint} onChange={(e) => handlerCurrencyChange(e.target.value)}>
                        {exampleUserPortfolioStore.map(t => (
                            <option key={t.tokenMeta.mint} value={t.tokenMeta.mint}>{t.tokenMeta.symbol}</option>)
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
}
