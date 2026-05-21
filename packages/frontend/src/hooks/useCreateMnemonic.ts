import bip39 from "bip39"
import { useState } from "react"

export const useCreateMnemonic = () => {
    const [mnemonic, setMnemonic] = useState<string | null>(null);

    const gen = () => {
        const m = bip39.generateMnemonic()
        setMnemonic(m)
    }

    return { mnemonic, gen }
}
