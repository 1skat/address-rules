import { useEffect } from "react";
import { useCreateMnemonic } from "../hooks/useCreateMnemonic"

export const MnemonicScreen = () => {
    const { mnemonic, gen } = useCreateMnemonic();

    useEffect(() => {
        gen()
    }, []);

    if (mnemonic === null) {
        return <span>waiting...</span>
    }

    return (
        <div>
            <span>{mnemonic}</span>
            {/* {mnemonic.split(" ").map((word, i) => (
                <span key={i}>{word}</span>
            ))} */}
        </div>
    )
}
