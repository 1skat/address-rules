import { useEffect, useState } from "react"
import { ConnectButton } from "./signInButtom";
import { useWallet } from "@solana/wallet-adapter-react";

export const ProviderPopup = () => {
    const [open, setOpen] = useState(false);
    const { connected } = useWallet()

    return (
        <div>
            <button onClick={() => setOpen(true)}>Connect</button>
            {
                open && !connected && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
                        <div className="bg-white p-10 shadow-lg w-120 flex flex-col">
                            < ConnectButton />
                            <button className="mt-4 text-sm" onClick={() => setOpen(false)}>Close</button>
                        </div>
                    </div>
                )
            }
        </div>
    )
}
