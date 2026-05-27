import { useState } from "react";
import { logout } from "../api/client"

export const LogoutButton = () => {
    const [loading, setLoading] = useState(false);
    const handleLogout = async () => {
        setLoading(true)
        await logout()
        setLoading(false)
    }

    return <button onClick={handleLogout} disabled={loading}>Logout</button>;
}
