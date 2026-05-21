import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { ProviderPopup } from "./providersPopup";

export const Layout = ({ children }) => {
    const wallets = useMemo(
        () => [],
        []
    );

    return (
        <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
            <WalletProvider wallets={wallets} autoConnect={false}>
                <div>
                    <header>
                        <ProviderPopup />
                    </header>

                    <main>{children}</main>
                </div>
            </WalletProvider>
        </ConnectionProvider>
    )
}
