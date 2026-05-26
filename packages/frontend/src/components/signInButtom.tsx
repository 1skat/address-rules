import { useAuth } from "../hooks/useAuth";

export const ConnectButton = () => {
    const { signIn } = useAuth();

    return <button className="bg-amber-300" onClick={signIn}>Connect</button>
};
