export const generateIndecies = () => {
    const out: Array<number> = [];
    while (out.length !== 3) {
        const idx = Math.floor(Math.random() * 12);
        if (out.includes(idx)) continue;

        out.push(idx)
    }
    return out;
}

export const shortFormat = (address: string) => (address.slice(0, 5) + "..." + address.slice(-4));

// export const solToLamport = (sol: string) => {
//     const [whole, decimal = ""] = sol.split(".")
//     const padded = (decimal + "000000000").slice(0, 9)

//     return BigInt(whole + padded);
// }

export const toSmallestUnit = (amount: string, decimals: number) => {
    if (!/^\d+(\.\d+)?$/.test(amount)) return null;
    const [whole, decimal = ""] = amount.split(".");
    const padded = (decimal + "0".repeat(decimals)).slice(0, decimals)

    return BigInt(whole + padded);
}

export const toUiAmount = (amount: bigint, decimals: number): string => {
    return (Number(amount) / 10 ** decimals).toString();
}


