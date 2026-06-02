import { ReactFlow, Background, Panel, useReactFlow, ReactFlowProvider, applyNodeChanges, type Viewport } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { useCallback, useMemo, useRef } from 'react';
import { CanvasToolbar } from './CanvasToolbar';
import { useCanvasStore } from '../../store/useCanvasStore';
import { WalletNode } from '../walletNode';
import { getStoredViewport, saveViewport } from '../../store/canvasViewport';
import { throttle } from '../utils/throttle';

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

    const nodes = useCanvasStore(s => s.nodes); // wallet nodes
    const setNodes = useCanvasStore(s => s.setNodes); // set wallet nodes (update on changes)
    const addNode = useCanvasStore(s => s.addNode); // add a new node
    const onNodesChange = useCallback((change) => { // custom callback
        setNodes(applyNodeChanges(change, nodes));
    }, [nodes, setNodes]);

    const onPaneClick = useCallback((e: React.MouseEvent) => {
        if (activeTool !== "add") return;

        const mousePosition = screenToFlowPosition({
            x: e.clientX,
            y: e.clientY,
        });

        addNode({
            id: crypto.randomUUID(),
            type: "wallet",
            position: mousePosition,
            data: { label: "new wallet" },
        });

    }, [activeTool, addNode, screenToFlowPosition]);

    return (
        <div className="w-screen h-screen">
            <ReactFlow
                defaultViewport={defaultViewport}
                onMove={onMove}
                fitView={false}
                nodeTypes={nodeTypes}
                nodes={nodes}
                onNodesChange={onNodesChange}
                onPaneClick={onPaneClick}
                className='bg-amber-50'
                panOnDrag={activeTool === "hand"}
                selectionOnDrag={activeTool === "cursor"}
                panOnScroll
            >
                <Panel>
                    <CanvasToolbar />
                </Panel>
                <Background variant='dots' />
            </ReactFlow>
        </div>
    );
}
