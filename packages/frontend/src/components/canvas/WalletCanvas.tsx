import { ReactFlow, Background, useReactFlow, ReactFlowProvider, type Viewport, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import React, { useCallback, useMemo } from 'react';
import { CanvasToolbar } from './CanvasToolbar';
import { useCanvasStore } from '../../store/useCanvasStore';
import { WalletNode } from '../walletNode';
import { getStoredViewport, saveViewport } from '../../store/canvasViewport';
import { createWallet } from '../../api/client';
import { WalletEdge } from '../walletEdge';
import { ConnectionLine } from '../connectionLine';
import { useToolStore } from '../../store/useToolStore';
import { useNodeInteraction } from '../../hooks/useNodeInteractions';
import { useEdgeInteraction } from '../../hooks/useEdgeInteractions';
import { SendSolanaTxCard } from './SendTxCard';
import { SettingsCard } from './SettingsCard';
import { throttle } from '../../utils/throttle';

export const WalletCanvas = () => {
    return (
        <ReactFlowProvider>
            <WalletCanvasInner />
        </ReactFlowProvider>
    );
}

const nodeTypes = { wallet: WalletNode };
const edgeTypes = { wallet: WalletEdge };

const WalletCanvasInner = () => {
    const activeTool = useToolStore(s => s.activeTool);

    const defaultViewport = useMemo(() => getStoredViewport(), []);

    const onMove = useMemo(
        () => throttle((_: MouseEvent, viewport: Viewport) => { // todo: a better way to hammer local storage?
            saveViewport(viewport);
        }, 100),
        []
    );

    const { screenToFlowPosition } = useReactFlow();

    // Nodes
    const nodes = useCanvasStore(s => s.nodes);
    const setNodes = useCanvasStore(s => s.setNodes);
    const addNode = useCanvasStore(s => s.addNode);

    // Edges
    const edges = useCanvasStore(s => s.edges);
    const addConnection = useCanvasStore(s => s.addConnection);
    const setEdges = useCanvasStore(s => s.setEdges);
    const { onNodeMouseEnter } = useNodeInteraction();
    const { onEdgeMouseEnter, onReconnectStart, onReconnect, onReconnectEnd, onEdgeClick } = useEdgeInteraction();

    // todo move to node hooks
    const onPaneClick = useCallback(async (e: React.MouseEvent) => {
        if (activeTool !== "add") return;

        const mousePosition = screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
        });

        // move to hooks
        try {
            const newWallet = await createWallet("501", null, mousePosition);
            addNode({
                id: newWallet.id,
                type: "wallet",
                position: mousePosition,
                data: {
                    address: newWallet.address,
                    alias: newWallet.alias,
                    derivationIndex: newWallet.derivation_index,
                    chainId: newWallet.chain_id,
                },
            });
        } catch (err) {
            console.error(`ERROR adding wallet: ${err}`);
        }

    }, [activeTool, addNode, screenToFlowPosition]);

    return (
        <div className="relative w-screen h-screen" data-tool={activeTool}>
            <ReactFlow
                className='bg-amber-200'
                defaultViewport={defaultViewport}
                connectionLineComponent={ConnectionLine}
                connectionMode={ConnectionMode.Loose}
                nodesConnectable={activeTool === "arrow"}
                edgesReconnectable={activeTool === "arrow"}
                onMove={onMove}
                fitView={false}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                // onEdgesChange={setEdges} // todo: do i need it since i have addConnection
                onConnect={addConnection}
                onReconnectStart={onReconnectStart}
                onReconnect={onReconnect}
                onReconnectEnd={onReconnectEnd}
                onEdgeClick={onEdgeClick} // Edge gets passed as arg
                onPaneClick={onPaneClick}
                panOnDrag={activeTool === "hand"}
                selectionOnDrag={activeTool === "cursor"}
                nodesDraggable={activeTool === "cursor"}
                onEdgeMouseEnter={onEdgeMouseEnter}
                onNodeMouseEnter={onNodeMouseEnter}
                panOnScroll
            >
                <Background variant='dots' />
                <CanvasToolbar />
                <SendSolanaTxCard />
                <SettingsCard />
            </ReactFlow>
        </div >
    );
}
