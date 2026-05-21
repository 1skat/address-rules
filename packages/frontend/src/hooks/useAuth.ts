import { jwtDecode } from "jwt-decode";
import { useWallet } from "@solana/wallet-adapter-react";
import { initLogin, verifyLogin } from "../api/client";
import type { SolanaSignInInput } from '@solana/wallet-standard-features';
import { useAuthStore } from "../store/authStore";
import { useOnbordingStore } from "../store/onboardingStore";
import { useCallback } from "react";

export const useAuth = () => {
    const { wallet, connect, connected } = useWallet()

    const signIn = useCallback(async () => {
        if (!wallet) return;
        if (!connected) await connect()

        const adapter = wallet.adapter;
        if (!adapter.publicKey || !("signIn" in adapter)) return;
        const address = adapter.publicKey.toBase58()

        const { nonce, sessionId } = await initLogin(address)

        const input: SolanaSignInInput = {
            domain: "addressrouter.xyz",
            uri: "https://addressrouter.com",
            statement: "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.",
            nonce,
            issuedAt: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
        };

        const output = await adapter.signIn(input)

        const { accessToken } = await verifyLogin({ // the jwt is returned here
            sessionId, walletType: "Phantom", address, input, output: {
                account: { publicKey: Array.from(output.account.publicKey) },
                signature: output.signature,
                signedMessage: output.signedMessage,
            }
        });
        const { sub } = jwtDecode<{ sub: string }>(accessToken);
        useAuthStore.getState().setUser({ id: sub }); // set user's id to use inside the components
        useOnbordingStore.setState({ step: "vault_check" })

    }, [wallet, connect, connected])

    return { signIn }
}
