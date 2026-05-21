import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/storeAuth";

export const ConnectButton = () => {
    const { user } = useAuthStore();
    const { signIn } = useAuth();

    if (user) {
        return <span>{user.id}</span>
    }
    return <button onClick={signIn}>Sign In</button>
};
