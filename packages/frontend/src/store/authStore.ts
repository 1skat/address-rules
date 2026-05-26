import { create } from "zustand"

interface AuthStore {
    user: { id: string } | null;
    accessToken: string | null;
    setUser: (user: { id: string }, accessToken: string) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    accessToken: null,
    setUser: (user, accessToken) => set({ user, accessToken }),
    clearAuth: () => set({ user: null })
}));
