import { BaseEdge, getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react"
import { memo } from "react";

export const ConnectionLine = memo(({ fromX, fromY, toX, toY, fromPosition, toPosition }: ConnectionLineComponentProps) => {
    const [linePath] = getBezierPath({ sourceX: fromX, sourceY: fromY, sourcePosition: fromPosition, targetPosition: toPosition, targetX: toX, targetY: toY })

    return (
        <BaseEdge

            path={linePath}
            style={{
                stroke: '#6b728',
                strokeWidth: 2,
                opacity: 0.4,
            }}
        />
    );
});
