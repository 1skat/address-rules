import { ReactFlow, Background, useReactFlow, ReactFlowProvider, type Viewport, ConnectionMode } from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import React, { useCallback, useMemo } from 'react';
import { CanvasToolbar } from './CanvasToolbar';
import { useCanvasStore } from '../../store/useCanvasStore';
import { WalletNode } from '../walletNode';
import { getStoredViewport, saveViewport } from '../../store/canvasViewport';
import { throttle } from '../utils/throttle';
import { SettingsCard } from './settingsCard';
import { createWallet } from '../../api/client';
import { WalletEdge } from '../walletEdge';
import { ConnectionLine } from '../connectionLine';

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
    const activeTool = useCanvasStore(s => s.activeTool);

    const defaultViewport = useMemo(() => getStoredViewport(), []);

    const onMove = useMemo(
        () => throttle((_: MouseEvent, viewport: Viewport) => {
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
    const reconnectEdge = useCanvasStore(s => s.reconnectEdge);

    const onPaneClick = useCallback(async (e: React.MouseEvent) => {
        if (activeTool !== "add") return;

        const mousePosition = screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
        });

        try {
            const newWallet = await createWallet("501", null, mousePosition);
            addNode({
                id: newWallet.id,
                type: "wallet",
                position: mousePosition,
                data: { label: newWallet.alias ?? newWallet.address.slice(0, 5) + "..." + newWallet.address.slice(-4) },
            });
        } catch (err) {
            console.error(`ERROR adding wallet: ${err}`);
        }

    }, [activeTool, addNode, screenToFlowPosition]);

    return (
        <div className="relative w-screen h-screen">
            <ReactFlow
                className='bg-amber-200'
                defaultViewport={defaultViewport}
                connectionLineComponent={ConnectionLine}
                connectionMode={ConnectionMode.Loose}
                onMove={onMove}
                fitView={false}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
                onConnect={addConnection}
                onReconnect={reconnectEdge}
                onPaneClick={onPaneClick}
                panOnDrag={activeTool === "hand"}
                selectionOnDrag={activeTool === "cursor"}
                nodesDraggable={activeTool === "cursor"}
                panOnScroll
            >
                <Background variant='dots' />
                <CanvasToolbar />
                <SettingsCard />
            </ReactFlow>
        </div >
    );
}
