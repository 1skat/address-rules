export const toUiAmount = (amount: bigint, decimals: number): string => {
    return (Number(amount) / 10 ** decimals).toString();
}
