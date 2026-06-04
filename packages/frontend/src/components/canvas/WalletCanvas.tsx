import { ReactFlow, Background, Panel, useReactFlow, ReactFlowProvider, applyNodeChanges, type Viewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useMemo } from 'react';
import { CanvasToolbar } from './CanvasToolbar';
import { useCanvasStore } from '../../store/useCanvasStore';
import { WalletNode } from '../walletNode';
import { getStoredViewport, saveViewport } from '../../store/canvasViewport';
import { throttle } from '../utils/throttle';
import { SettingsCard } from './settingsCard';
import { createWallet } from '../../api/client';

export const WalletCanvas = () => {
    return (
        <ReactFlowProvider>
            <WalletCanvasInner />
        </ReactFlowProvider>
    );
}

const nodeTypes = { wallet: WalletNode };

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

    const nodes = useCanvasStore(s => s.nodes);
    const setNodes = useCanvasStore(s => s.setNodes);
    const addNode = useCanvasStore(s => s.addNode);
    const onNodesChange = useCallback((change) => {
        setNodes(applyNodeChanges(change, nodes));
    }, [nodes, setNodes]);

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
                data: { label: newWallet.alias ?? newWallet.address.slice(0, 8).padEnd(11, ".") },
            });
        } catch (err) {
            console.error(`ERROR adding wallet: ${err}`)
        }

    }, [activeTool, addNode, screenToFlowPosition]);

    return (
        <div className="relative w-screen h-screen">
            <ReactFlow
                className='bg-amber-50'
                defaultViewport={defaultViewport}
                onMove={onMove}
                fitView={false}
                nodeTypes={nodeTypes}
                nodes={nodes}
                onNodesChange={onNodesChange}
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
