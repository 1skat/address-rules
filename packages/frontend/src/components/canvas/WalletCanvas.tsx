import { ReactFlow, Background, Panel, useReactFlow, ReactFlowProvider, applyNodeChanges } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';
import { CanvasToolbar, type Tool } from './CanvasToolbar';
import { useCanvasStore } from '../../store/useCanvasStore';

export const WalletCanvas = () => {
    return (
        <ReactFlowProvider>
            <WalletCanvasInner />
        </ReactFlowProvider>
    );
}

const WalletCanvasInner = () => {
    const activeTool = useCanvasStore(s => s.activeTool);

    const nodes = useCanvasStore(s => s.nodes);
    const setNodes = useCanvasStore(s => s.setNodes);
    const addNode = useCanvasStore(s => s.addNode);
    const onNodesChange = useCallback((change) => {
        setNodes(applyNodeChanges(change, nodes));
    }, [nodes, setNodes]);

    const { screenToFlowPosition } = useReactFlow();

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
    )
}
