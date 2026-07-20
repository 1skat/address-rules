import { Panel } from "@xyflow/react";
import { useToolStore } from "../../store/useToolStore"
import React, { useEffect, useRef, useState } from "react";
import { useCanvasStore, type TokenEntryData, type TokenMeta, type TransactionEdge } from "../../store/useCanvasStore";
import { toSmallestUnit, toUiAmount } from "../../lib/utils";
import { buildSolanaTransaction, buildTransferInstruction } from "../../lib/transactions";
import { deriveKeypair } from "../../lib/bip39";
import { address, stringifiedBigInt } from "@solana/kit";
import { AddressLabel } from "../AddressLabel";
import { sendSolanaTransaction, subscribeOrderStatus } from "../../api/ws";
import { tryCatchAsync } from "../../utils/try-catch";


const exampleUserPortfolioStore: Record<string, TokenMeta> = {
    "0b94bf38-b88c-4867-8957-7143e0d86235": {
        tokenId: "0b94bf38-b88c-4867-8957-7143e0d86235",
        chainId: "501",
        mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        symbol: "USDC",
        name: "USDC",
        decimals: 6,
    },
    "14ce98ee-5006-4bc7-a360-1ff1b826892f": {
        tokenId: "14ce98ee-5006-4bc7-a360-1ff1b826892f",
        chainId: "501",
        mint: "11111111111111111111111111111111",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
    }
}

export const SendSolanaTxCard = React.memo(() => {
    const activeTool = useToolStore(s => s.activeTool);
    const selectedEdgeId = useCanvasStore(s => s.selectedEdgeId);
    const selectedEdge = useCanvasStore(s => s.edges.find(e => e.id === selectedEdgeId));
    const setEdgeSelectedMint = useCanvasStore(s => s.setEdgeSelectedMint);
    const setEdgeTokenDraftAmount = useCanvasStore(s => s.setEdgeTokenDraftAmount);
    const addEdgeToken = useCanvasStore(s => s.addEdgeToken)
    const removeEdgeToken = useCanvasStore(s => s.removeEdgeToken);
    const setEdgeTokenEntry = useCanvasStore(s => s.setEdgeTokenEntry);
    const setEdgeTokenPending = useCanvasStore(s => s.setEdgeTokenPending);
    const nodes = useCanvasStore(s => s.nodes);
    const [amount, setAmount] = useState<bigint>(0n);
    const [pending, setPending] = useState(false);
    const [err, setErr] = useState<Error | null>(null);
    const edgeRef = useRef<{ edgeId: string, prevTokenId: string, prevTokenEntry: TokenEntryData } | null>(null);

    useEffect(() => {
        if (!selectedEdge /*diselected*/ && edgeRef.current) {
            const { edgeId, prevTokenId, prevTokenEntry } = edgeRef.current;
            const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId);
            if (edge) {
                const currTokenId = edge.data.selectedTokenId;
                const currTokenEntry = edge.data.tokens[currTokenId];

                if (currTokenId === prevTokenId) { // same token
                    if (currTokenEntry.state === "draft") {
                        // fetch from backend?
                        setEdgeTokenEntry(edgeId, prevTokenId, prevTokenEntry);
                    }
                } else {
                    if (currTokenEntry.state === "draft") {
                        removeEdgeToken(edgeId, currTokenId)
                        setEdgeSelectedMint(edgeId, prevTokenId)
                    }
                }
            }

            edgeRef.current = null;
        }
        if (selectedEdge && edgeRef.current === null) {
            const currTokenId = selectedEdge.data.selectedTokenId;

            edgeRef.current = { edgeId: selectedEdge.id, prevTokenId: currTokenId, prevTokenEntry: selectedEdge.data.tokens[currTokenId] } // put to localstorage or index db (cached) as SOL_ADDRESS_UUID
        }
    }, [removeEdgeToken, setEdgeSelectedMint, selectedEdge, setEdgeTokenEntry])

    if (activeTool !== "cursor" || !selectedEdge) return null;

    const fromNode = nodes.find(n => n.id === selectedEdge.source);
    const toNode = nodes.find(n => n.id === selectedEdge.target);


    const handlerCurrencyChange = (tokenId: string) => {
        if (!tokenId) {
            console.error("token id not found")
            return
        }
        const exists = selectedEdge.data?.tokens[tokenId];
        if (!exists) {
            addEdgeToken(selectedEdge.id, tokenId, exampleUserPortfolioStore[tokenId]);
        }
        setEdgeSelectedMint(selectedEdge.id, tokenId);
    }

    const onClickHandler = async () => {
        try {
            setPending(true)
            if (amount <= 0n) {
                setErr(new Error("Invalid amount"));
                return;
            };

            const fromAddressKpSigner = await deriveKeypair(fromNode?.data.chainId, fromNode?.data.derivationIndex)
            const toAddress = address(toNode?.data.address);
            const edgeId = selectedEdge.id;
            const tokenId = selectedEdge.data.selectedTokenId;

            const tokenData = exampleUserPortfolioStore[tokenId];
            if (!tokenData) {
                console.error(`token data not found`);
                return
            }
            const ixs = await buildTransferInstruction(fromAddressKpSigner, toAddress, amount, tokenData);
            const signedTx = await buildSolanaTransaction(fromAddressKpSigner, ixs); // get a signature here locally

            setEdgeTokenPending(selectedEdge.id, selectedEdge.data.selectedTokenId); // set pending
            const [acceptedTx, acceptedTxErr] = await tryCatchAsync(() => sendSolanaTransaction(signedTx, selectedEdge.id)); // returns pending + actual amounts
            if (acceptedTxErr) { // reset back to draft
                setEdgeTokenDraftAmount(edgeId, tokenId, {
                    state: "draft",
                    amount: selectedEdge.data.tokens[tokenId].totalAmount,
                    uiAmount: selectedEdge.data.tokens[tokenId].uiTotalAmount,
                })
                return setErr(acceptedTxErr)
            }
            subscribeOrderStatus(acceptedTx?.orderId, selectedEdge.id, selectedEdge.data.selectedTokenId);
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
                        const decimals = exampleUserPortfolioStore[selectedEdge.data.selectedTokenId].decimals;
                        if (!decimals) return;

                        const val = toSmallestUnit(e.target.value, decimals);
                        if (val) {
                            setAmount(val);

                            setEdgeTokenDraftAmount(selectedEdge.id, selectedEdge.data.selectedTokenId, {
                                state: "draft",
                                amount: stringifiedBigInt(val.toString()),
                                uiAmount: toUiAmount(val, decimals)
                            });
                        }
                    }} />
                    <select value={selectedEdge.data?.selectedTokenId} onChange={(e) => handlerCurrencyChange(e.target.value)}>
                        {Object.entries(exampleUserPortfolioStore).map(([ti, td]) => (
                            <option key={ti} value={ti}>{td.symbol}</option>)
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
