import './App.css'
import '@solana/wallet-adapter-react-ui/styles.css';
import { useOnbordingStore } from './store/onboardingStore';
import { MnemonicScreen } from './components/createMnemonic';
import { VaultChecker } from './components/vaultChecker';
import { MnemonicVerifier } from './components/mnemonicVerifier';
import { PasswordCreator } from './components/passwordCreator';

function App() {
  const step = useOnbordingStore(s => s.step)

  switch (step) {
    case "unauthenticated": return null;
    case "vault_check": return <VaultChecker />;
    case "create_mnemonic": return <MnemonicScreen />;
    case "confirm_mnemonic": return <MnemonicVerifier />;
    case "password": return <PasswordCreator />;
    case "ready": return <span>done</span>;
  }
}

export default App
