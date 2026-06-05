import { BaseEdge, getBezierPath, getStraightPath, type GetBezierPathParams, type GetStraightPathParams } from "@xyflow/react"
import { memo } from "react";

export const WalletEdge = memo(({ sourceX, sourceY, sourcePosition, targetPosition, targetX, targetY }: GetBezierPathParams) => {
    const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

    return (
        <BaseEdge
            path={edgePath}
            style={{
                stroke: '#6b7280',
                strokeWidth: 2,
                strokeDasharray: '5 10',
                animation: "dashMove 1.5s linear infinite"
            }}
        />
    )
});
