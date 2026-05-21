import { useVaultCheck } from "../hooks/useVaultCheck"

export const VaultChecker = () => {
    useVaultCheck()
    return <div>Loading...</div>
}
