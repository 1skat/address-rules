import { useState } from "react"
import { useOnbordingStore } from "../store/onboardingStore";
import { encryptMnemonic } from "../lib/crypto";
import { saveMnemonic } from "../lib/vault";
import bip39 from "bip39"
import { setSeed } from "../lib/seed";

export const PasswordCreator = () => {
    const [password, setPassword] = useState<string>("");
    const [confirmPassword, setConfirmPassword] = useState<string>("");
    const [err, setErr] = useState<string | null>(null);

    const handleConfirm = async () => {
        if (password !== confirmPassword) {
            setErr("Password don't match");
            return;
        }
        if (password.length < 8) {
            setErr("Password has to be minimum 8 characters");
            return;
        }

        const mnemonic = useOnbordingStore.getState().mnemonic;
        if (!mnemonic) {
            return;
        }
        const encryptedBlob = await encryptMnemonic(mnemonic, password.trim());
        const saved = await saveMnemonic(encryptedBlob);
        if (!saved) {
            setErr("Failed to save mnemonic in your browser");
            return;
        }

        const seed = bip39.mnemonicToSeedSync(mnemonic);
        setSeed(seed);

        useOnbordingStore.getState().clearMenmonic();
        useOnbordingStore.getState().setStep("ready");
    }

    return (
        <div>
            {err && <p className="bg-red-600">{err}</p>}
            <span>Create password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}></input>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}></input>
            <button onClick={handleConfirm}>Confirm</button>
        </div>
    )

}
