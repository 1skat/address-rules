import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"
import { memo, useCallback } from "react";
import { useCanvasStore, type EdgeTransactionDataV3 } from "../store/useCanvasStore";

type GetSpecialPathParams = {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
};

const getSpecialPath = (
    { sourceX, sourceY, targetX, targetY }: GetSpecialPathParams,
    offset: number,
): [path: string, labelX: number, labelY: number] => {
    // todo: use the hypotenuse to shirnk the offset on long distance
    const centerX = (sourceX + targetX) / 2;
    const centerY = (sourceY + targetY) / 2;

    return [
        `M ${sourceX} ${sourceY} Q ${centerX} ${centerY + offset} ${targetX} ${targetY}`,
        centerX,
        centerY + offset / 2,
    ];
};

// const animationCss = {
//     "processed": undefined,
//     "pending": "pulse 1.5s ease-in-out infinite",
//     "draft": undefined,
// }

export const WalletEdge = memo(({ sourceX, sourceY, sourcePosition, targetPosition, targetX, targetY, source, target, data }: EdgeProps) => {
    const isBidirectionalEdge = useCanvasStore(
        useCallback((s) => s.edges.some(e =>
            (e.source === target && e.target === source) ||
            (e.target === source && e.source === target)
        ), [source, target])
    );

    if (!data) return;
    const { selectedTokenId, tokens } = data as EdgeTransactionDataV3;
    const tokenData = tokens[selectedTokenId];
    if (!tokenData) {
        console.error("no token data found for edgeId")
        return;
    }

    // const isBidirectionalEdge = edges.some(e => (e.source === target && e.target === source) || (e.target === source && e.source === target));
    const [edgePath, labelX, labelY] = isBidirectionalEdge
        ? getSpecialPath({ sourceX, sourceY, targetX, targetY }, sourceX < targetX ? 35 : -35)
        : getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

    return (
        <>
            <BaseEdge
                path={edgePath}
                interactionWidth={20}
                style={{
                    strokeWidth: 2,
                    strokeDasharray: '5 10',
                    // animation: animationCss[tokenData.state]
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                    }}
                    className="nodrag nopan cursor-pointer px-2 py-1"
                >
                    <span>{tokenData.uiTotalAmount} {tokenData.tokenMeta.symbol}</span >
                </div>
            </EdgeLabelRenderer>
        </>
    );
});
