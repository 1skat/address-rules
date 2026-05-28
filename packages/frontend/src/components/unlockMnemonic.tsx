import { useState } from "react";
import { getMnemonic } from "../lib/vault";
import { decryptMnemonic } from "../lib/crypto";
import bip39 from "bip39";
import { setSeed } from "../lib/seed";
import { useOnbordingStore } from "../store/onboardingStore";

export const UnlockMnemonic = () => {
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleUnlock = async () => {
        try {
            setLoading(true);
            const blob = await getMnemonic();
            const mnemonic = await decryptMnemonic(blob, password.trim());
            const seed = bip39.mnemonicToSeedSync(mnemonic);
            setSeed(seed);
            useOnbordingStore.getState().setStep("ready");
        } catch (err) {
            setErr(`wrong passwrod: ${err}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            {err && <p className="text-rose-500">{err}</p>}
            <input className="border-2 border-white" type="password" value={password} onChange={(e) => setPassword(e.target.value)}></input>
            <button onClick={handleUnlock} disabled={loading}>confirm</button>
        </div>
    );
}
