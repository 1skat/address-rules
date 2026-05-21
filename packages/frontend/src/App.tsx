import './App.css'
import { ConnectionProvider, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { useCallback, useMemo } from 'react';
import '@solana/wallet-adapter-react-ui/styles.css';
// import type { Adapter } from '@solana/wallet-adapter-base';
// import type { SolanaSignInInput } from '@solana/wallet-standard-features';
import { ConnectButton } from './components/signInButtom';


// const ConnectButton = () => {
//   const signInHandler = useCallback(async (adapter: Adapter) => {
//     if (!adapter.publicKey) return;
//     if (!("signIn" in adapter)) return true;

//     const initResp = await fetch("http://localhost:3000/account/login-by-wallet/init", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         address: adapter.publicKey?.toBase58(),
//         walletType: "Phantom",
//         chain: "sol",
//       })
//     });

//     const { nonce, sessionId } = await initResp.json();

//     const input: SolanaSignInInput = {
//       domain: "addressrouter.xyz",
//       uri: "https://addressrouter.com",
//       statement: "Clicking Sign or Approve only means you have proved this wallet is owned by you. This request will not trigger any blockchain transaction or cost any gas fee.",
//       nonce,
//       issuedAt: new Date().toISOString(),
//       expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
//     };

//     const output = await adapter.signIn(input)

//     await fetch("http://localhost:3000/account/login-by-wallet/verify", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         sessionId,
//         walletType: "Phantom",
//         address: adapter.publicKey.toBase58(),
//         input,
//         output: {
//           account: { publicKey: Array.from(output.account.publicKey) },
//           signature: output.signature,
//           signedMessage: output.signedMessage,
//         }
//       })
//     });

//     return false;
//   }, []);

// const { wallet, connect, connected } = useWallet()
// const handleClick = async () => {
//   if (!wallet) return;
//   if (!connected) await connect()
//   signInHandler(wallet.adapter)
// }

// return (
//   <div>
//     <button onClick={handleClick}>Sing In</button>
//   </div>
// )
// };

function App() {
  const wallets = useMemo(
    () => [],
    []
  );

  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      <WalletProvider wallets={wallets} autoConnect={false}>
        < ConnectButton />
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default App
