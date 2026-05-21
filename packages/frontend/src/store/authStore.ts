import { create } from "zustand"

interface AuthStore {
    user: { id: string } | null;
    setUser: (user: { id: string }) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    setUser: (user) => set({ user })
}));
