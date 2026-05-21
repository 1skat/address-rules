import { useState } from "react";
import { useOnbordingStore } from "../store/onboardingStore";

export const MnemonicVerifier = () => {
    const [threeWordsFromMnemonic, setThreeWordsFromMnemonic] = useState("");
    const [invalidMnemonicErr, setInvalidMnemonicErr] = useState<string | null>(null);

    const handleVerify = () => {
        const userMnemonic = useOnbordingStore.getState().mnemonic;
        const isValid = userMnemonic?.includes(threeWordsFromMnemonic);

        if (!isValid || threeWordsFromMnemonic.length !== 3) {
            setInvalidMnemonicErr("Mnemonic is invalid")
            return;
        }

        return setInvalidMnemonicErr(null)
    }

    return (
        <div>
            {invalidMnemonicErr && <p className="text-red-500">{invalidMnemonicErr}</p>}
            <span>Provide the pharse:</span>
            <input value={threeWordsFromMnemonic} onChange={(e) => setThreeWordsFromMnemonic(e.target.value)}></input>
            <button onClick={handleVerify}>Verify</button>
        </div>
    )
};
