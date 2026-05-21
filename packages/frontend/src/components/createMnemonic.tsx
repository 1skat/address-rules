import { useEffect, useState } from "react";
import { useCreateMnemonic } from "../hooks/useCreateMnemonic"
import { useOnbordingStore } from "../store/onboardingStore";

export const MnemonicScreen = () => {
    const { mnemonic, gen } = useCreateMnemonic();
    const [copied, setCopied] = useState(false);

    const handleSaved = () => {
        useOnbordingStore.setState({ step: "confirm_mnemonic" })
    }
    const handleCopy = async () => {
        try {
            if (!mnemonic) return;

            await navigator.clipboard.writeText(mnemonic)
            setCopied(true)
            useOnbordingStore.getState().setMnemonic(mnemonic)
        } catch (err) {
            console.error(err)
        }
    };
    useEffect(() => {
        gen()
    }, []);

    if (mnemonic === null) {
        return <span>waiting...</span>
    }

    return (
        <div>
            <div>
                <span>{mnemonic}</span>
            </div>
            {copied ? <span>Copied</span> : <button onClick={() => handleCopy()}>Copy phrase</button>}
            <button onClick={() => handleSaved()}>I saved the phrase</button>
        </div>
    )
}
