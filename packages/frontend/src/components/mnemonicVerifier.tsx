import { useState } from "react";
import { useOnbordingStore } from "../store/onboardingStore";
import { generateIndecies } from "../utils/utils";

export const MnemonicVerifier = () => {
    const [userInput, setUserInput] = useState("");
    const [mnemonicErr, setMnemonicErr] = useState<string | null>(null);
    const [indecies] = useState(() => generateIndecies())

    const handleVerify = () => {
        const storedMnemonic = useOnbordingStore.getState().mnemonic?.split(" ");
        if (!storedMnemonic) return null;

        const validWords = indecies.map(i => storedMnemonic[i]);
        const userMnemonic = userInput.trim().split(" ");

        const isValid = validWords.every((word, i) => word === userMnemonic[i])

        if (!isValid) {
            setMnemonicErr("Mnemonic is invalid");
            return;
        }

        useOnbordingStore.getState().setStep("password");
        return setMnemonicErr(null);
    }

    return (
        <div>
            {mnemonicErr && <p className="text-red-500">{mnemonicErr}</p>}
            <span>What is word: {indecies.map(i => i + 1).join(", ").trim()}</span>
            <input value={userInput} onChange={(e) => setUserInput(e.target.value)}></input>
            <button onClick={handleVerify}>Verify</button>
        </div>
    )
};
