import { useEffect } from "react"
import { checkMnemonicExists } from "../lib/vault"
import { useOnbordingStore } from "../store/onboardingStore"

export const useVaultCheck = () => {
    const setStep = useOnbordingStore(s => s.setStep)

    useEffect(() => {
        checkMnemonicExists().then((hasMnemonic: boolean) => {
            setStep(hasMnemonic ? "ready" : "create_mnemonic")

        })
    }, []);
}
