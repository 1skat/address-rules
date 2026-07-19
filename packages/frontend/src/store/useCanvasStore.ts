import { create } from "zustand"
import { persist } from "zustand/middleware"
import { addEdge, applyEdgeChanges, applyNodeChanges, reconnectEdge as rfReconnectEdge, type Connection, type Edge, type Node } from "@xyflow/react"
import { stringifiedBigInt, type StringifiedBigInt } from "@solana/kit";

type EdgeTokenState = "draft" | "pending" | "processed";

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
    state: "draft" | "pending" | "processed";
    tokenMeta: TokenMeta;
    totalAmount: StringifiedBigInt;
    uiTotalAmount: string;
}

export type EdgeTransactionDataV3 = {
    chainId: "501";
    selectedTokenId: string;
    tokens: Record<string, TokenEntryData>;
}

export type EdgeTransactionData =
    | {
        state: "draft" | "pending" | "processed";
        chainId: "501";
        selectedMint: string;
        tokens: Record<string, {
            tokenMeta: TokenMeta;
            totalAmount: StringifiedBigInt;
            uiTotalAmount: string;
        }>;
    }
    | {
        state: "draft" | "pending" | "processed";
        chainId: "60";
        selectedMint: string;
        tokens: Record<string, {
            tokenMeta: TokenMeta;
            totalAmount: StringifiedBigInt;
            uiTotalAmount: string;
        }>;
    };
export type TransactionEdge = Edge<EdgeTransactionDataV3>;

export type BalanceUpdateData = {
    state: "pending" | "processed";
    amount: StringifiedBigInt;
    uiAmount: string;
}

export type DraftAmountData = {
    state: "draft";
    amount: StringifiedBigInt;
    uiAmount: string;
}

type CanvasStore = {
    nodes: Node[];
    setNodes: (change: any) => void;
    addNode: (node: Node) => void;
    removeNode: (id: string) => void;
    removeEdge: (id: string) => void;
    edges: TransactionEdge[];
    // selectedEdge: TransactionEdge | null;
    // setSelectedEdge: (edge: TransactionEdge | null) => void;
    selectedEdgeId: string | null;
    setSelectedEdgeId: (edgeId: string | null) => void;
    setEdgeSelectedMint: (edgeId: string, tokenId: string) => void;
    addEdgeToken: (edgeId: string, chainId: string, tokenMeta: TokenMeta) => void;
    removeEdgeToken: (edgeId: string, tokenId: string) => void;
    // getSelectedEdge: () => TransactionEdge | null;
    setEdges: (change: any) => void;
    setEdgeState: (edgeId: string, tokenId: string, status: EdgeTokenState) => void;
    addConnection: (connection: Connection, edgeData: EdgeTransactionDataV3) => string;
    reconnectEdge: (oldEdge: TransactionEdge, newConnection: Connection) => void;
    updateEdgeTokenBalance: (edgeId: string, tokenId: string, data: BalanceUpdateData) => void;
    setEdgeTokenDraftAmount: (edgeId: string, tokenId: string, data: DraftAmountData) => void;
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
            // getSelectedEdge: () => get().edges.find(e => e.id === get().selectedEdgeId) ?? null,
            setNodes: (change) => set((s) => ({ nodes: applyNodeChanges(change, s.nodes) })), // update the eniter array
            // addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
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
            // setSelectedEdge: (edge: TransactionEdge | null) => {
            //     console.log("selected edge:", edge)
            //     return set({ selectedEdge: edge })
            // },
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
            updateEdgeTokenBalance: (edgeId: string, tokenId: string, data: BalanceUpdateData) => {
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
                                        ...e.data.tokens[tokenId], totalAmount: data.amount, uiTotalAmount: data.uiAmount,
                                    }
                                }
                            }
                        }
                    })
                }))
            },
            setEdgeTokenDraftAmount: (edgeId: string, tokenId: string, data: DraftAmountData) => {
                set((s) => ({
                    edges: s.edges.map((e) => {
                        if (e.id !== edgeId || !e.data || !e.data.tokens[tokenId]) return e;

                        return {
                            ...e,
                        }

                    })
                }))
            },
            setEdgeState: (edgeId: string, tokenId: string, txState: "draft" | "pending" | "processed") => {
                set((s) => ({
                    edges: s.edges.map((e) => e.id === edgeId && e.data ? {
                        ...e, data: {
                            ...e.data,
                            tokens: {
                                ...e.data.tokens,
                                [tokenId]: {
                                    ...e.data.tokens[tokenId],
                                    status: txState
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

                        console.log("meta", tokenMeta);
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
                        console.log("REST", rest)
                        return {
                            ...e, data: { ...e.data, ...rest }
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
//     console.log(`accumulate totals for ${e.id}`, data);
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
