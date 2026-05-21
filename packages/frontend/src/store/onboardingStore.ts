import { create } from "zustand";

type OnboardingStep =
    | "unauthenticated"
    | "vault_check"
    | "enter_existing_mnemonic"
    | "create_mnemonic"
    | "confirm_mnemonic"
    | "password"
    | "ready"


interface OnboardingStore {
    step: OnboardingStep;
    mnemonic: string | null;
    setStep: (step: OnboardingStep) => void;
    setMnemonic: (mnemonic: string | null) => void;
};

export const useOnbordingStore = create<OnboardingStore>((set) => ({
    step: "unauthenticated",
    mnemonic: null,

    setStep: (step: OnboardingStep) => set({ step }),
    setMnemonic: (mnemonic: string | null) => set({ mnemonic })
}));


