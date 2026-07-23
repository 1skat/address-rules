import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"
import { stringifiedBigInt, type StringifiedBigInt } from "@solana/kit";

export type TransactionState = "draft" | "pending" | "executing" | "processed";

export type TokenMeta = {
    tokenId: string;
    chainId: string;
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    iconURI?: string;
}

export type TokenEntryData = {
    state: TransactionState;
    tokenMeta: TokenMeta;
    totalAmount: StringifiedBigInt;
    uiTotalAmount: string;
}

export type EdgeTransactionDataV3 = {
    chainId: "501";
    selectedTokenId: string;
    tokens: Record<string, TokenEntryData>;
}

export type TokenBalanceInfo = {
    tokenMeta: TokenMeta;
    balanceAmount: StringifiedBigInt;
    uiBalanceAmount: string;
}

export type NodeWalletData = {
    derivationIndex: `${number}`, // fix later
    chainId: "501",
    address: string,
    alias: string | null,
    selectedTokenId: string;
    tokens: Record<string, TokenBalanceInfo>
}

export type NodeWallet = Node<NodeWalletData> & { data: NodeWalletData };
export type TransactionEdge = Edge<EdgeTransactionDataV3> & { data: EdgeTransactionDataV3 };

export type BalanceData = {
    amount: StringifiedBigInt;
    uiAmount: string;
}

export type BalanceUpdateData = {
    state: "executing" | "processed";
    amount: StringifiedBigInt;
    uiAmount: string;
}

export type DraftAmountData = {
    state: "draft";
    amount: StringifiedBigInt;
    uiAmount: string;
}

type CanvasStore = {
    nodes: NodeWallet[];
    edges: TransactionEdge[];
    selectedEdgeId: string | null;
    setNodes: (change: any) => void;
    addNode: (node: NodeWallet) => void;
    removeNode: (id: string) => void;
    removeEdge: (id: string) => void;
    setSelectedEdgeId: (edgeId: string | null) => void;
    setEdgeSelectedMint: (edgeId: string, tokenId: string) => void;
    setNodeSelectedMint: (walletId: string, tokenId: string) => void;
    addEdgeToken: (edgeId: string, chainId: string, tokenMeta: TokenMeta) => void;
    removeEdgeToken: (edgeId: string, tokenId: string) => void;
    setEdges: (change: any) => void;
    setEdgeTokenPending: (edgeId: string, tokenId: string) => void;
    addConnection: (connection: Connection, edgeData: EdgeTransactionDataV3) => string;
    reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => void;
    // balances
    updateEdgeTokenBalance: (edgeId: string, tokenId: string, data: BalanceUpdateData) => void;
    updateNodeWalletBalance: (walletId: string, tokenId: string, balance: BalanceData) => void;
    setEdgeTokenDraftAmount: (edgeId: string, tokenId: string, data: DraftAmountData) => void;
    // token meta
    setEdgeTokenEntry: (edgeId: string, tokenId: string, data: TokenEntryData) => void;
    addNodeWalletToken: (walletId: string, tokenId: string, data: TokenMeta) => void;
}

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set) => ({
            nodes: [],
            edges: [],
            // selectedEdge: null,
            selectedEdgeId: null,
            setSelectedEdgeId: (edgeId: string | null) => {
                return set({ selectedEdgeId: edgeId });
            },
            setNodes: (change) => set((s) => ({ nodes: applyNodeChanges(change, s.nodes) })), // update the eniter array
            addNode: (node) => {
                console.log("adding node", node);
                set((s) => ({ nodes: [...s.nodes, node] }))
            },
            removeNode: (id: string) => set((s) => ({
                nodes: s.nodes.filter(n => n.id !== id),
                edges: s.edges.filter(e => e.source !== id && e.target !== id)
            })),
            removeEdge: (id: string) => {
                console.log("removing edge:", id)
                set((s) => ({ edges: s.edges.filter(e => e.id !== id) }))
            },
            addConnection: (connection, data: EdgeTransactionDataV3) => {
                const id = crypto.randomUUID();
                set((s) => ({
                    edges: addEdge<TransactionEdge>({
                        ...connection,
                        id,
                        type: "wallet",
                        data,
                    }, s.edges)
                }));

                return id;
            },
            setEdges: (change) => set((s) => {
                return { edges: applyEdgeChanges(change, s.edges) }
            }),
            reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => {
                console.log(oldEdge.id)
                set((s) => ({
                    edges: rfReconnectEdge(oldEdge, newConnection, s.edges)
                }))
            },
            setEdgeSelectedMint: (edgeId: string, tokenId: string) => {
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId && e.data
                        ? { ...e, data: { ...e.data, selectedTokenId: tokenId } }
                        : e,
                    )
                }))
            },
            setNodeSelectedMint: (walletId: string, tokenId: string) => {
                set((s) => ({
                    nodes: s.nodes.map((n) => n.id === walletId
                        ? { ...n, data: { ...n.data, selectedTokenId: tokenId } }
                        : n,
                    )
                }));
            },
            updateNodeWalletBalance: (walletId: string, tokenId: string, balance: BalanceData) => {
                set((s) => ({
                    nodes: s.nodes.map((n) => {
                        if (n.id !== walletId || !n.data.tokens[tokenId]) return n;

                        return {
                            ...n,
                            data: {
                                ...n.data,
                                tokens: {
                                    ...n.data.tokens,
                                    [tokenId]: {
                                        ...n.data.tokens[tokenId], balanceAmount: balance.amount, uiBalanceAmount: balance.uiAmount,
                                    }

                                }
                            }
                        }
                    })
                }))
            },
            addNodeWalletToken: (walletId: string, tokenId: string, data: TokenMeta) => {
                set((s) => ({
                    nodes: s.nodes.map((w) => {
                        if (w.id !== walletId || !w.data.tokens[tokenId]) return w;

                        return {
                            ...w,
                            data: {
                                ...w.data,
                                tokens: {
                                    ...w.data.tokens,
                                    [tokenId]: {
                                        tokenMeta: data,
                                        balanceAmount: stringifiedBigInt("0"),
                                        uiBalanceAmount: "0",
                                    }
                                }
                            }
                        }
                    })
                }))
            },
            updateEdgeTokenBalance: (edgeId: string, tokenId: string, data: BalanceUpdateData) => {
                const { state, amount, uiAmount } = data;
                set((s) => ({
                    edges: s.edges.map((e) => {
                        if (e.id !== edgeId || !e.data || !e.data.tokens[tokenId]) return e;

                        return {
                            ...e,
                            data: {
                                ...e.data,
                                tokens: {
                                    ...e.data.tokens,
                                    [tokenId]: {
                                        ...e.data.tokens[tokenId], totalAmount: amount, uiTotalAmount: uiAmount, state: state
                                    }
                                }
                            }
                        }
                    })
                }))
            },
            setEdgeTokenDraftAmount: (edgeId: string, tokenId: string, data: DraftAmountData) => {
                const { state, amount, uiAmount } = data;
                set((s) => ({
                    edges: s.edges.map((e) => {
                        if (e.id !== edgeId || !e.data || !e.data.tokens[tokenId]) return e;

                        return {
                            ...e,
                            data: {
                                ...e.data,
                                tokens: {
                                    ...e.data.tokens,
                                    [tokenId]: {
                                        ...e.data.tokens[tokenId], totalAmount: amount, uiTotalAmount: uiAmount, state: state
                                    }
                                }
                            }
                        }

                    })
                }))
            },
            setEdgeTokenEntry: (edgeId: string, tokenId: string, data: TokenEntryData) => {
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId && e.data ? {
                        ...e, data: {
                            ...e.data,
                            tokens: {
                                ...e.data.tokens,
                                [tokenId]: data,
                            }
                        }
                    } : e)
                }));
            },
            setEdgeTokenPending: (edgeId: string, tokenId: string) => {
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId && e.data ? {
                        ...e, data: {
                            ...e.data,
                            tokens: {
                                ...e.data.tokens,
                                [tokenId]: {
                                    ...e.data.tokens[tokenId],
                                    status: "pending",
                                }
                            }
                        }
                    } : e)
                }));
            },
            addEdgeToken: (edgeId: string, tokenId: string, tokenMeta: TokenMeta) => {
                set((s) => ({
                    edges: s.edges.map((e) => {
                        if (e.id !== edgeId || !e.data || e.data.tokens[tokenId] /*skip if exists*/) return e;

                        return {
                            ...e, data: {
                                ...e.data,
                                tokens: {
                                    ...e.data.tokens, [tokenId]: {
                                        tokenMeta, state: "draft", totalAmount: stringifiedBigInt("0"), uiTotalAmount: "0"
                                    }
                                }
                            }

                        }
                    })
                }));
            },
            removeEdgeToken: (edgeId: string, tokenId: string) => {
                set((s) => ({
                    edges: s.edges.map((e) => {
                        if (e.id !== edgeId || !e.data) return e;

                        const { [tokenId]: _/*excluded*/, ...rest } = e.data.tokens;
                        return {
                            ...e, data: {
                                ...e.data, tokens: {
                                    ...rest
                                }
                            }
                        }
                    })
                }))
            }
        }),
        {
            name: "canvas-store",
            partialize: (s) => ({ nodes: s.nodes, edges: s.edges })
        }
    ),
);


// const accumulateTotals = (e: TransactionEdge, data: CurrencyUpdateData): TransactionEdge => {
//     console.log(`accumulate totals for ${ e.id }`, data);
//     const { mint, tokenMeta, amountInfo } = data;
//     const prev = e.data?.tokens[mint] // null on new
//     const newAmount = (prev ? BigInt(prev.totalAmount) : BigInt(0)) + BigInt(amountInfo.amount);
//     const newUi = (prev ? parseFloat(prev.uiTotalAmount) : 0) + parseFloat(amountInfo.uiAmount);

//     return {
//         ...e /*TranasctionEdge*/,
//         data: {
//             ...e.data,
//             selectedMint: mint,
//             tokens: {
//                 ...e.data?.tokens,
//                 [mint]: {
//                     tokenMeta, totalAmount: stringifiedBigInt(newAmount.toString()), uiTotalAmount: newUi.toString(),
//                 },
//             }
//         }
//     }
// };
