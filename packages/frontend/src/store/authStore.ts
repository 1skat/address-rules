import { create } from "zustand"

interface AuthStore {
    user: { id: string } | null;
    accessToken: string | null;
    setUser: (user: { id: string }) => void;
    setAccessToken: (accessToken: string) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    accessToken: null,
    setUser: (user) => set({ user }),
    setAccessToken: (accessToken) => set({ accessToken }),
    clearAuth: () => set({ user: null, accessToken: null })
}));
