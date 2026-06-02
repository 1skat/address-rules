import type { Viewport } from "@xyflow/react";

const KEY = 'wallet-canvas-viewport';
const DEFAULT = { x: 0, y: 0, zoom: 1 };

export const getStoredViewport = () => {
    try {
        const stored = localStorage.getItem(KEY);
        return stored ? JSON.parse(stored) : DEFAULT;
    } catch {
        return DEFAULT;
    }
}

export const saveViewport = (vp: Viewport) => {
    localStorage.setItem(KEY, JSON.stringify(vp));
}
