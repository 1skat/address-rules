import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";

export const ConnectButton = () => {
    const { user } = useAuthStore();
    const { signIn } = useAuth();

    if (user) {
        return null;
    }

    return <button className="bg-amber-300" onClick={signIn}>Connect</button>
};
