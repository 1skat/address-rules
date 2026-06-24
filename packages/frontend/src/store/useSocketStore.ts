import { create } from "zustand";

type SocketState = "disconnected" | "connecting" | "ready";

type SocketStore = {
    status: SocketState;
    setStatus: (status: SocketState) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
    status: "disconnected",
    setStatus: (status: SocketState) => set({ status }),
}));
