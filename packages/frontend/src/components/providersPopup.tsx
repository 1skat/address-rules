import { useEffect, useState } from "react"
import { ConnectButton } from "./signInButtom";
import { useAuthStore } from "../store/authStore";
import { LogoutButton } from "./logoutButton";

export const ProviderPopup = () => {
    const [open, setOpen] = useState(false);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (!user) {
            setOpen(false)
        }
    }, [user])

    return (
        <div>
            {
                user
                    ? <LogoutButton />
                    : <button onClick={() => setOpen(true)}>Connect</button>
            }
            {
                open && !user && (
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
